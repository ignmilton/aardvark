import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenBlacklistService } from './token-blacklist.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { BanCheckGuard } from './guards/ban-check.guard';
import { User, UserBan } from '@/database/entities';

/**
 * Authentication module providing JWT-based authentication,
 * user registration, login, and password management.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserBan]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('jwt.secret'),
        signOptions: {
          expiresIn: configService.get('jwt.accessExpiration', '15m'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenBlacklistService, JwtStrategy, LocalStrategy, BanCheckGuard],
  exports: [AuthService, TokenBlacklistService, JwtModule, BanCheckGuard],
})
export class AuthModule {}
