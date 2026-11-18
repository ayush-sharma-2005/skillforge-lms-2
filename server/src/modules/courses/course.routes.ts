import { Router } from "express";
import mongoose from "mongoose";

import {
  createCourse,
  getCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
  getMyCourses,
  toggleCoursePublish,
  addCourseTranslation,
} from "./course.controller";

import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";

import {
  createCourseSchema,
  updateCourseSchema,
  courseTranslationSchema,
} from "./course.validation";

const router = Router();

// Specific routes must come before dynamic routes
router.get(
  "/my-courses",
  authenticate,
  authorize("instructor", "admin"),
  getMyCourses
);

// Public routes
router.get("/", getCourses);
router.get("/:id", (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return next();
  }

  return getCourseById(req, res, next);
});

// Protected routes (instructor and admin)
router.post(
  "/",
  authenticate,
  authorize("instructor", "admin"),
  validate(createCourseSchema),
  createCourse
);

router.post(
  "/:id/translations",
  authenticate,
  authorize("instructor", "admin"),
  validate(courseTranslationSchema),
  addCourseTranslation
);

router.patch(
  "/:id/publish",
  authenticate,
  authorize("instructor", "admin"),
  toggleCoursePublish
);

router.patch(
  "/:id",
  authenticate,
  authorize("instructor", "admin"),
  validate(updateCourseSchema),
  updateCourse
);

router.delete(
  "/:id",
  authenticate,
  authorize("instructor", "admin"),
  deleteCourse
);

export default router;
