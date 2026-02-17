import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { TokenBlacklistService } from "./token-blacklist.service";
import { LocalAuthGuard } from "./guards/local-auth.guard";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { ForgotPasswordDto, ResetPasswordDto } from "./dto/reset-password.dto";
import { AuthenticatedRequest } from "@/common/interfaces/authenticated-request.interface";

/**
 * Authentication controller handling registration, login,
 * token refresh, and password management endpoints.
 */
@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tokenBlacklistService: TokenBlacklistService,
  ) {}

  /**
   * Register a new user account
   */
  @Post("register")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: "Register a new user" })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  /**
   * Login with email and password
   */
  @Post("login")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(LocalAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Login with credentials" })
  async login(@Request() req: { user: any }, @Body() _loginDto: LoginDto) {
    return this.authService.login(req.user);
  }

  /**
   * Refresh access token
   * Rate limited to prevent brute force attacks on refresh tokens
   */
  @Post("refresh")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Refresh access token" })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  /**
   * Get current authenticated user
   */
  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Get current user" })
  async getCurrentUser(@Request() req: { user: { userId: string } }) {
    return this.authService.getCurrentUser(req.user.userId);
  }

  /**
   * Logout and invalidate the current token
   */
  @Post("logout")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Logout current user" })
  async logout(@Request() req: AuthenticatedRequest) {
    // Extract token and add to blacklist so it can't be reused
    // JwtAuthGuard ensures auth header is present, so this branch always executes
    const authHeader = req.headers?.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      try {
        const parts = token.split(".");
        if (parts.length !== 3) {
          // Malformed JWT — blacklist with default TTL
          await this.tokenBlacklistService.blacklistToken(token, 15 * 60);
        } else {
          const decoded = JSON.parse(
            Buffer.from(parts[1], "base64url").toString(),
          );
          // Use at least 60s TTL to prevent race where token with 0 remaining
          // seconds is immediately evicted from the blacklist
          const remainingSeconds =
            typeof decoded.exp === "number"
              ? Math.max(60, decoded.exp - Math.floor(Date.now() / 1000))
              : 15 * 60;
          await this.tokenBlacklistService.blacklistToken(
            token,
            remainingSeconds,
          );
        }
      } catch {
        // Fallback: blacklist for default access token lifetime
        await this.tokenBlacklistService.blacklistToken(token, 15 * 60);
      }
    }
    return { message: "Logged out successfully" };
  }

  /**
   * Request password reset (sends email with reset link)
   */
  @Post("forgot-password")
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Request password reset email" })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.requestPasswordReset(dto.email);
    return {
      message:
        "If an account with that email exists, a reset link has been sent",
    };
  }

  /**
   * Reset password with token
   */
  @Post("reset-password")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reset password with token" })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: "Password has been reset successfully" };
  }

  /**
   * Change password for authenticated user
   */
  @Post("change-password")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Change password" })
  async changePassword(
    @Request() req: { user: { userId: string } },
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(
      req.user.userId,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword,
    );
    return { message: "Password changed successfully" };
  }
}
