import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import {
  getStudentDashboard,
  getMyCourses,
} from "./student.controller";

const router = Router();

router.get("/dashboard", authenticate, getStudentDashboard);
router.get("/my-courses", authenticate, getMyCourses);

export default router;