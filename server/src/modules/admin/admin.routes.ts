import { Router } from "express";

import {
  getAdminDashboard,
  getAllUsers,
  getUserById,
  updateUserStatus,
  getAllCourses,
  getCourseById,
  approveCourse,
  rejectCourse,
  adminDeleteCourse,
} from "./admin.controller";

import {
  authenticate,
  authorize,
} from "../../middlewares/auth.middleware";

const router = Router();

// All admin routes require admin authentication
router.use(authenticate);
router.use(authorize("admin"));

// Dashboard
router.get("/dashboard", getAdminDashboard);

// User Management
router.get("/users", getAllUsers);
router.get("/users/:userId", getUserById);
router.patch("/users/:userId/status", updateUserStatus);

// Course Management
router.get("/courses", getAllCourses);
router.get("/courses/:courseId", getCourseById);
router.patch("/courses/:courseId/approve", approveCourse);
router.patch("/courses/:courseId/reject", rejectCourse);
router.delete("/courses/:courseId", adminDeleteCourse);

export default router;