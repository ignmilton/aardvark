import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/**
 * Local authentication guard for username/password login.
 */
@Injectable()
export class LocalAuthGuard extends AuthGuard("local") {}
