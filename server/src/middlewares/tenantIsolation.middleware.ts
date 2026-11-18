import type { Response, NextFunction } from "express";
import mongoose from "mongoose";
import type { AuthRequest } from "./auth.middleware";
import { ApiError } from "../utils/ApiError";
import { Organization } from "../modules/organizations/organization.model";

/**
 * Middleware ensuring strict tenant-level data isolation.
 * Prevents organization administrators from accessing or modifying another tenant's data.
 */
export const enforceTenantIsolation = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;

    if (!userId) {
      throw new ApiError(401, "Authentication required");
    }

    // System super-admins have cross-tenant oversight
    if (userRole === "admin") {
      return next();
    }

    if (userRole !== "org_admin") {
      throw new ApiError(
        403,
        "You do not have permission to access organization management"
      );
    }

    // Resolve target organization ID from route params or body
    const rawTargetId =
      req.params.id ||
      req.params.orgId ||
      req.body.organizationId ||
      req.query.organizationId;

    const targetOrgId =
      typeof rawTargetId === "string" ? rawTargetId.trim() : undefined;

    if (targetOrgId && !mongoose.Types.ObjectId.isValid(targetOrgId)) {
      throw new ApiError(400, "Invalid organization ID format");
    }

    // Find organizations where this user is designated as admin
    const authorizedOrg = await Organization.findOne({
      adminUsers: new mongoose.Types.ObjectId(userId),
      isActive: true,
    });

    if (!authorizedOrg) {
      throw new ApiError(
        403,
        "No active organization found associated with your administrator account"
      );
    }

    // If a specific target organization was requested, strictly check match
    if (targetOrgId && authorizedOrg._id.toString() !== targetOrgId) {
      throw new ApiError(
        403,
        "Tenant isolation violation: You do not have permission to access another organization's data"
      );
    }

    // Attach resolved organization to request for convenient downstream use
    req.organizationId = authorizedOrg._id.toString();

    next();
  } catch (error) {
    next(error);
  }
};
