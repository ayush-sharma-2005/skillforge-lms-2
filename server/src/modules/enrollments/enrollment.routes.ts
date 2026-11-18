import { Router } from "express";

import {
  enrollInCourse,
  getMyEnrollments,
} from "./enrollment.controller";

import { authenticate } from "../../middlewares/auth.middleware";

const router = Router();

router.post("/:courseId", authenticate, enrollInCourse);

router.get("/my-enrollments", authenticate, getMyEnrollments);

export default router;