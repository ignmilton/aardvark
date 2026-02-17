import { Request } from "express";
import { UserRole } from "@aardvark/shared";

export interface AuthenticatedUser {
  id: string;
  userId: string;
  username: string;
  role: UserRole;
  email?: string;
  displayName?: string;
  [key: string]: unknown;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
