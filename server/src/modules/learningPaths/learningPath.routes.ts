import { Router } from "express";
import mongoose from "mongoose";

import {
  createLearningPath,
  getLearningPaths,
  getLearningPathById,
  updateLearningPath,
  deleteLearningPath,
  toggleLearningPathPublish,
  getMyCreatedLearningPaths,
  enrollInLearningPath,
  getLearningPathProgress,
  getMyLearningPaths,
  checkLearningPathCourseAccess,
} from "./learningPath.controller";

import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";

import {
  createLearningPathSchema,
  updateLearningPathSchema,
} from "./learningPath.validation";

const router = Router();

// Student-specific and Instructor-specific fixed routes (before /:id)
router.get("/student/my-paths", authenticate, getMyLearningPaths);
router.get(
  "/instructor/my-paths",
  authenticate,
  authorize("instructor", "admin"),
  getMyCreatedLearningPaths
);

// Public list
router.get("/", getLearningPaths);

// Public single path details
router.get("/:id", (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return next();
  }
  return getLearningPathById(req, res, next);
});

// Student path actions
router.post("/:id/enroll", authenticate, enrollInLearningPath);
router.get("/:id/progress", authenticate, getLearningPathProgress);
router.get(
  "/:id/courses/:courseId/access",
  authenticate,
  checkLearningPathCourseAccess
);

// Instructor / Admin management routes
router.post(
  "/",
  authenticate,
  authorize("instructor", "admin"),
  validate(createLearningPathSchema),
  createLearningPath
);

router.patch(
  "/:id/publish",
  authenticate,
  authorize("instructor", "admin"),
  toggleLearningPathPublish
);

router.patch(
  "/:id",
  authenticate,
  authorize("instructor", "admin"),
  validate(updateLearningPathSchema),
  updateLearningPath
);

router.delete(
  "/:id",
  authenticate,
  authorize("instructor", "admin"),
  deleteLearningPath
);

export default router;

