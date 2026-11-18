import { Router } from "express";

import {
  createCourseVersion,
  getCourseVersions,
  getCourseVersionDetail,
  compareCourseVersions,
} from "./courseVersion.controller";

import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { createCourseVersionSchema } from "./courseVersion.validation";

const router = Router();

router.use(authenticate);

// List all versions of a course
router.get("/course/:courseId", getCourseVersions);

// Create new version snapshot of a course
router.post(
  "/course/:courseId",
  authorize("instructor", "admin"),
  validate(createCourseVersionSchema),
  createCourseVersion
);

// Compare two versions
router.get("/compare/:versionId1/:versionId2", compareCourseVersions);

// Get single version details
router.get("/:versionId", getCourseVersionDetail);

export default router;

