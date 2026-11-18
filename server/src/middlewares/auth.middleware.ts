import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError";
import { User } from "../modules/auth/auth.model";

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
  organizationId?: string;
}

export const authenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers?.authorization;
    const bearerToken =
      typeof authHeader === "string" && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : undefined;
    const token = req.cookies?.sf_token || bearerToken;

    if (!token) {
      throw new ApiError(401, "Authentication required");
    }

    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error("JWT_SECRET is not configured");
    }

    const decoded = jwt.verify(token, secret);

    if (typeof decoded !== "object" || !decoded.sub) {
      throw new ApiError(401, "Invalid authentication token");
    }

    const user = await User.findById(decoded.sub).select(
      "_id role isActive organization"
    );

    if (!user) {
      throw new ApiError(401, "User no longer exists");
    }

    // Check whether account is active
    if (!user.isActive) {
      throw new ApiError(
        403,
        "Your account has been deactivated. Please contact administrator."
      );
    }

    req.userId = user.id;
    req.userRole = user.role;
    req.organizationId = user.organization ? user.organization.toString() : undefined;

    next();
  } catch (error) {
    next(
      error instanceof ApiError
        ? error
        : new ApiError(401, "Invalid or expired authentication token")
    );
  }
};

export const authorize = (...roles: string[]) => {
  return (
    req: AuthRequest,
    _res: Response,
    next: NextFunction
  ): void => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      next(
        new ApiError(403, "You are not authorized to access this resource")
      );
      return;
    }

    next();
  };
};
