import type { Response, NextFunction } from "express";
import type { AuthRequest } from "./auth.middleware";
import { ApiError } from "../utils/ApiError";

type UserRole = "student" | "instructor" | "admin" | "org_admin";

export const authorize = (...allowedRoles: UserRole[]) => {
  return (
    req: AuthRequest,
    _res: Response,
    next: NextFunction
  ): void => {
    if (!req.userId || !req.userRole) {
      next(new ApiError(401, "Authentication required"));
      return;
    }

    if (!allowedRoles.includes(req.userRole as UserRole)) {
      next(new ApiError(403, "You do not have permission to access this resource"));
      return;
    }

    next();
  };
};