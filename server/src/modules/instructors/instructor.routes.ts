import { Router } from "express";

import {
  authenticate,
  authorize,
} from "../../middlewares/auth.middleware";

import {
  getInstructorDashboard,
  getCourseStudents,
} from "./instructor.controller";
import {
  getLiveOverviewAnalytics,
  getCourseLiveAnalytics,
} from "./instructor.analytics.controller";

const router = Router();

// GET /api/instructors/dashboard
router.get(
  "/dashboard",
  authenticate,
  authorize("instructor", "admin"),
  getInstructorDashboard
);

// GET /api/instructors/analytics/overview
router.get(
  "/analytics/overview",
  authenticate,
  authorize("instructor", "admin"),
  getLiveOverviewAnalytics
);

// GET /api/instructors/analytics/courses/:courseId
router.get(
  "/analytics/courses/:courseId",
  authenticate,
  authorize("instructor", "admin"),
  getCourseLiveAnalytics
);

// GET /api/instructors/courses/:courseId/students
router.get(
  "/courses/:courseId/students",
  authenticate,
  authorize("instructor", "admin"),
  getCourseStudents
);

export default router;