import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UserBan } from "@/database/entities";

/**
 * Guard to check if the authenticated user is banned.
 * Prevents banned users from performing any protected actions.
 * Should be used after JwtAuthGuard to ensure user is authenticated.
 */
@Injectable()
export class BanCheckGuard implements CanActivate {
  constructor(
    @InjectRepository(UserBan)
    private readonly userBanRepository: Repository<UserBan>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // No user means JwtAuthGuard handled it or route is public
    if (!user || !user.id) {
      return true;
    }

    // Check for active ban
    const activeBan = await this.userBanRepository.findOne({
      where: {
        userId: user.id,
        isActive: true,
      },
    });

    if (activeBan) {
      // Check if temporary ban has expired
      if (!activeBan.isPermanent && activeBan.expiresAt) {
        if (new Date() > activeBan.expiresAt) {
          // Auto-expire the ban
          activeBan.isActive = false;
          await this.userBanRepository.save(activeBan);
          return true;
        }
      }

      // User is banned - check if shadowban
      if (activeBan.isShadowban) {
        // For shadowbans, we allow the request but mark it
        // The service layer should check this and silently discard content
        request.isShadowbanned = true;
        return true;
      }

      // Regular ban - deny access
      const reason = activeBan.details || "Your account has been suspended.";
      const expiryMsg = activeBan.isPermanent
        ? "This ban is permanent."
        : `Your ban expires on ${activeBan.expiresAt?.toISOString()}.`;

      throw new ForbiddenException({
        statusCode: 403,
        error: "Forbidden",
        message: `Account suspended: ${reason}`,
        details: expiryMsg,
        banId: activeBan.id,
      });
    }

    return true;
  }
}
