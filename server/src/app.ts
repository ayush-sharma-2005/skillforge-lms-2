import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import authRoutes from "./modules/auth/auth.routes";
import { authenticate, AuthRequest } from "./middlewares/auth.middleware";
import { authorize } from "./middlewares/role.middleware";
import { errorHandler } from "./middlewares/error.middleware";
import userRoutes from "./modules/users/user.routes";
import courseRoutes from "./modules/courses/course.routes";
import enrollmentRoutes from "./modules/enrollments/enrollment.routes";
import lessonRoutes from "./modules/lessons/lesson.routes";
import progressRoutes from "./modules/progress/progress.routes";
import studentRoutes from "./modules/students/student.routes";
import instructorRoutes from "./modules/instructors/instructor.routes";
import reviewRoutes from "./modules/reviews/review.routes";
import wishlistRoutes from "./modules/wishlist/wishlist.routes";
import adminRoutes from "./modules/admin/admin.routes";
import learningPathRoutes from "./modules/learningPaths/learningPath.routes";
import discussionRoutes from "./modules/discussions/discussion.routes";
import learningTimeRoutes from "./modules/learningTime/learningTime.routes";
import resourceRoutes from "./modules/resources/resource.routes";
import courseVersionRoutes from "./modules/courseVersions/courseVersion.routes";
import assignmentRoutes from "./modules/assignments/assignment.routes";
import peerReviewRoutes from "./modules/peerReviews/peerReview.routes";
import certificateRoutes from "./modules/certificates/certificate.routes";
import guardianRoutes from "./modules/guardians/guardianAccess.routes";
import organizationRoutes from "./modules/organizations/organization.routes";

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use(cookieParser());

app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 500,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  })
);

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "SkillForge LMS API is running",
    timestamp: new Date().toISOString(),
  });
});

app.get(
  "/api/admin/test",
  authenticate,
  authorize("admin"),
  (_req, res) => {
    res.status(200).json({
      success: true,
      message: "Admin access granted",
    });
  }
);

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/enrollments", enrollmentRoutes);
app.use("/api/lessons", lessonRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/instructors", instructorRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/learning-paths", learningPathRoutes);
app.use("/api/discussions", discussionRoutes);
app.use("/api/learning-time", learningTimeRoutes);
app.use("/api/resources", resourceRoutes);
app.use("/api/course-versions", courseVersionRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/peer-reviews", peerReviewRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/guardians", guardianRoutes);
app.use("/api/organizations", organizationRoutes);

// Unknown routes
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Error handler must come after routes and other middleware.
app.use(errorHandler);

export default app;
