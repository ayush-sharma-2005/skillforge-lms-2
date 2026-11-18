import { Router } from "express";

import {
  recordHeartbeat,
  getStudentTimeAnalytics,
  getCourseTimeAnalytics,
} from "./learningTime.controller";

import { authenticate } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { heartbeatSchema } from "./learningTime.validation";

const router = Router();

router.use(authenticate);

// Student heartbeat ping during active lesson learning
router.post(
  "/heartbeat",
  validate(heartbeatSchema),
  recordHeartbeat
);

// Student personal time analytics
router.get("/student/summary", getStudentTimeAnalytics);

// Instructor / Admin course analytics
router.get("/courses/:courseId", getCourseTimeAnalytics);

export default router;

