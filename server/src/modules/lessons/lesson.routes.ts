import { Router } from "express";

import {
  createLesson,
  getCourseLessons,
  updateLesson,
  deleteLesson,
  reorderLessons,
  toggleLessonPublish,
  addLessonTranslation,
  getAccessibleLessonContext,
  getCourseAccessibilityAudit,
} from "./lesson.controller";

import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  createLessonSchema,
  updateLessonSchema,
  lessonTranslationSchema,
} from "./lesson.validation";

const router = Router();

// Accessibility audit for a course (Public or authenticated)
router.get("/courses/:courseId/accessibility-audit", getCourseAccessibilityAudit);

// Accessible lesson context (Screen-reader metadata, keyboard shortcuts, captions & transcript)
router.get("/:lessonId/accessible-context", authenticate, getAccessibleLessonContext);

// Create a lesson — Instructor / Admin required
router.post(
  "/:courseId",
  authenticate,
  authorize("instructor", "admin"),
  validate(createLessonSchema),
  createLesson
);

// Get lessons for a course (enrolled student / instructor / admin)
router.get("/course/:courseId", authenticate, getCourseLessons);

// Update a lesson — Instructor / Admin required
router.patch(
  "/:lessonId",
  authenticate,
  authorize("instructor", "admin"),
  validate(updateLessonSchema),
  updateLesson
);

// Add translation to lesson — Instructor / Admin required
router.post(
  "/:lessonId/translations",
  authenticate,
  authorize("instructor", "admin"),
  validate(lessonTranslationSchema),
  addLessonTranslation
);

// Delete a lesson — Instructor / Admin required
router.delete(
  "/:lessonId",
  authenticate,
  authorize("instructor", "admin"),
  deleteLesson
);

// Reorder lessons — Instructor / Admin required
router.patch(
  "/course/:courseId/reorder",
  authenticate,
  authorize("instructor", "admin"),
  reorderLessons
);

router.patch(
  "/:lessonId/publish",
  authenticate,
  authorize("instructor", "admin"),
  toggleLessonPublish
);

export default router;
