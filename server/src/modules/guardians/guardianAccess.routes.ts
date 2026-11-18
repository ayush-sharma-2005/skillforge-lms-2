import { Router } from "express";

import {
  inviteGuardian,
  acceptGuardianInvite,
  getMyGuardians,
  updateGuardianPermissions,
  revokeGuardianAccess,
  getGuardianStudents,
  getStudentProgressForGuardian,
} from "./guardianAccess.controller";

import { authenticate } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  inviteGuardianSchema,
  updateGuardianPermissionsSchema,
} from "./guardianAccess.validation";

const router = Router();

router.use(authenticate);

// Student invitation and management routes
router.post("/invite", validate(inviteGuardianSchema), inviteGuardian);
router.get("/my-guardians", getMyGuardians);
router.patch(
  "/:id/permissions",
  validate(updateGuardianPermissionsSchema),
  updateGuardianPermissions
);
router.post("/:id/revoke", revokeGuardianAccess);
router.delete("/:id", revokeGuardianAccess);

// Guardian acceptance and progress view routes
router.post("/accept/:inviteToken", acceptGuardianInvite);
router.get("/students", getGuardianStudents);
router.get("/students/:studentId/progress", getStudentProgressForGuardian);

export default router;

