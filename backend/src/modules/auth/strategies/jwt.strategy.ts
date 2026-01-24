import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { User } from '@/database/entities';
import { AccountStatus } from '@aardvark/shared';
import { TokenBlacklistService } from '../token-blacklist.service';

/**
 * JWT payload interface
 */
interface JwtPayload {
  sub: string;
  username: string;
  role: string;
  iat: number;
  exp: number;
}

/**
 * JWT authentication strategy for Passport.
 * Validates JWT tokens and extracts user information.
 * Checks token blacklist to enforce server-side logout.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly tokenBlacklistService: TokenBlacklistService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('jwt.secret'),
      passReqToCallback: true,
    });
  }

  /**
   * Validate JWT payload and return user info.
   * This is called automatically by Passport after token verification.
   */
  async validate(req: Request, payload: JwtPayload) {
    // Check if token has been blacklisted (user logged out)
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    if (token && this.tokenBlacklistService.isBlacklisted(token)) {
      throw new UnauthorizedException('Token has been invalidated');
    }
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
      select: ['id', 'username', 'role', 'accountStatus'],
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.accountStatus === AccountStatus.BANNED) {
      throw new UnauthorizedException('Account has been banned');
    }

    if (user.accountStatus === AccountStatus.SUSPENDED) {
      throw new UnauthorizedException('Account is suspended');
    }

    return {
      userId: payload.sub,
      username: payload.username,
      role: payload.role,
    };
  }
}
