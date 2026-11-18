import { Router } from "express";

import {
  createOrganization,
  getOrganizations,
  getOrganizationById,
  updateOrganization,
  addMember,
  removeMember,
  assignCourse,
  removeCourse,
  getOrganizationMembers,
  bulkEnrollStudents,
  getOrganizationAnalytics,
} from "./organization.controller";

import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { enforceTenantIsolation } from "../../middlewares/tenantIsolation.middleware";

import {
  createOrganizationSchema,
  updateOrganizationSchema,
  addMemberSchema,
  assignCourseSchema,
  bulkEnrollSchema,
} from "./organization.validation";

const router = Router();

router.use(authenticate);

// System Admin: Create new organization
router.post(
  "/",
  authorize("admin"),
  validate(createOrganizationSchema),
  createOrganization
);

// Admin / Org Admin: List accessible organizations
router.get("/", authorize("admin", "org_admin"), getOrganizations);

// Tenant-Isolated Routes below (Admin or assigned Org Admin)
router.get("/:id", enforceTenantIsolation, getOrganizationById);
router.put(
  "/:id",
  enforceTenantIsolation,
  validate(updateOrganizationSchema),
  updateOrganization
);

// Members & Roster management
router.get("/:id/members", enforceTenantIsolation, getOrganizationMembers);
router.post(
  "/:id/members",
  enforceTenantIsolation,
  validate(addMemberSchema),
  addMember
);
router.delete("/:id/members/:memberId", enforceTenantIsolation, removeMember);

// Curriculum assignment
router.post(
  "/:id/courses",
  enforceTenantIsolation,
  validate(assignCourseSchema),
  assignCourse
);
router.delete("/:id/courses/:courseId", enforceTenantIsolation, removeCourse);

// Bulk student enrollment
router.post(
  "/:id/bulk-enroll",
  enforceTenantIsolation,
  validate(bulkEnrollSchema),
  bulkEnrollStudents
);

// Tenant-level analytics dashboard
router.get("/:id/analytics", enforceTenantIsolation, getOrganizationAnalytics);

export default router;
