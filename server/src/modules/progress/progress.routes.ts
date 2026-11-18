import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import {
  completeLesson,
  getCourseProgress,
} from "./progress.controller";

const router = Router();

// Mark lesson as complete (supporting both standard and short route shapes)
router.post(
  "/:courseId/lessons/:lessonId/complete",
  authenticate,
  completeLesson
);

router.post(
  "/:courseId/:lessonId",
  authenticate,
  completeLesson
);

router.get("/:courseId", authenticate, getCourseProgress);

export default router;
