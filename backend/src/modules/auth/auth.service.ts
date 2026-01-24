import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import {
  UserRole,
  AccountStatus,
  RegisterUserDto,
  AuthResponse,
} from '@aardvark/shared';
import { User } from '@/database/entities';

/**
 * Authentication service handling user registration, login,
 * token generation, and password management.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly SALT_ROUNDS = 12;
  private readonly RESET_TOKEN_EXPIRY_HOURS = 1;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Register a new user account
   */
  async register(registerDto: RegisterUserDto): Promise<AuthResponse> {
    const { username, email, password, displayName } = registerDto;

    // Check if username or email already exists
    const existingUser = await this.userRepository.findOne({
      where: [{ username }, { email }],
    });

    if (existingUser) {
      if (existingUser.username === username) {
        throw new ConflictException('Username already taken');
      }
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, this.SALT_ROUNDS);

    // Create user
    const user = this.userRepository.create({
      username,
      email,
      passwordHash,
      displayName: displayName || username,
      role: UserRole.READER,
      accountStatus: AccountStatus.ACTIVE, // For MVP, auto-verify
      emailVerified: true, // For MVP
      emailVerificationToken: nanoid(32),
    });

    await this.userRepository.save(user);

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Remove sensitive data
    const { passwordHash: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword as User,
      ...tokens,
    };
  }

  /**
   * Validate user credentials for login
   */
  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { email },
      select: [
        'id',
        'username',
        'email',
        'passwordHash',
        'displayName',
        'avatarUrl',
        'bio',
        'role',
        'accountStatus',
        'subscriptionStatus',
        'creditsBalance',
        'preferences',
        'emailVerified',
        'createdAt',
        'updatedAt',
      ],
    });

    if (!user) {
      return null;
    }

    // Check account status
    if (user.accountStatus === AccountStatus.BANNED) {
      throw new UnauthorizedException('Account has been banned');
    }

    if (user.accountStatus === AccountStatus.SUSPENDED) {
      throw new UnauthorizedException('Account is suspended');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return null;
    }

    // Remove password hash from return
    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }

  /**
   * Login user and return tokens
   */
  async login(user: User): Promise<AuthResponse> {
    // Update last login
    await this.userRepository.update(user.id, {
      lastLoginAt: new Date(),
      loginAttempts: 0,
    });

    const tokens = await this.generateTokens(user);

    return {
      user,
      ...tokens,
    };
  }

  /**
   * Generate JWT access and refresh tokens
   */
  async generateTokens(
    user: User,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };

    const accessExpiration = this.configService.get(
      'jwt.accessExpiration',
      '15m',
    );
    const refreshExpiration = this.configService.get(
      'jwt.refreshExpiration',
      '7d',
    );

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: accessExpiration,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('jwt.refreshSecret'),
        expiresIn: refreshExpiration,
      }),
    ]);

    // Calculate expiration in seconds
    const expiresIn = this.parseExpirationToSeconds(accessExpiration);

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get('jwt.refreshSecret'),
      });

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const newPayload = {
        sub: user.id,
        username: user.username,
        role: user.role,
      };

      const accessExpiration = this.configService.get(
        'jwt.accessExpiration',
        '15m',
      );
      const accessToken = await this.jwtService.signAsync(newPayload, {
        expiresIn: accessExpiration,
      });

      return {
        accessToken,
        expiresIn: this.parseExpirationToSeconds(accessExpiration),
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Get current user by ID
   */
  async getCurrentUser(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'passwordHash'],
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

    await this.userRepository.update(userId, {
      passwordHash: newPasswordHash,
    });
  }

  /**
   * Request a password reset. Generates a token and stores it on the user.
   * In production, this should send an email with the reset link.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { email },
    });

    // Always return success to prevent email enumeration
    if (!user) return;

    const resetToken = nanoid(48);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.RESET_TOKEN_EXPIRY_HOURS);

    await this.userRepository.update(user.id, {
      passwordResetToken: resetToken,
      passwordResetExpires: expiresAt,
    });

    // In production, send email via configured email service
    const resetUrl = `${this.configService.get('FRONTEND_URL', 'http://localhost:3000')}/auth/reset-password?token=${resetToken}`;
    this.logger.log(`Password reset requested for ${email}. Reset URL: ${resetUrl}`);
  }

  /**
   * Reset password using a valid reset token.
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { passwordResetToken: token },
      select: ['id', 'passwordResetToken', 'passwordResetExpires'],
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (!user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      // Clear expired token
      await this.userRepository.update(user.id, {
        passwordResetToken: null,
        passwordResetExpires: null,
      });
      throw new BadRequestException('Reset token has expired');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

    await this.userRepository.update(user.id, {
      passwordHash: newPasswordHash,
      passwordResetToken: null,
      passwordResetExpires: null,
    });
  }

  /**
   * Parse time string to seconds
   */
  private parseExpirationToSeconds(expiration: string): number {
    const unit = expiration.slice(-1);
    const value = parseInt(expiration.slice(0, -1), 10);

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 60 * 60 * 24;
      default:
        return 900; // Default 15 minutes
    }
  }
}
