import { Router } from "express";

import {
  createAssignment,
  getAssignmentsByCourse,
  getAssignmentById,
  updateAssignment,
  deleteAssignment,
  submitAssignment,
  getSubmissionsByAssignment,
  getSubmissionDetail,
  gradeSubmission,
  triggerPlagiarismCheck,
  triggerAiEvaluation,
} from "./assignment.controller";

import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  createAssignmentSchema,
  updateAssignmentSchema,
  submitAssignmentSchema,
  gradeSubmissionSchema,
} from "./assignment.validation";

const router = Router();

router.use(authenticate);

// Course assignments
router.get("/course/:courseId", getAssignmentsByCourse);

// Single assignment CRUD
router.post(
  "/",
  authorize("instructor", "admin"),
  validate(createAssignmentSchema),
  createAssignment
);

router.get("/:id", getAssignmentById);

router.put(
  "/:id",
  authorize("instructor", "admin"),
  validate(updateAssignmentSchema),
  updateAssignment
);

router.delete("/:id", authorize("instructor", "admin"), deleteAssignment);

// Student submission
router.post(
  "/:id/submit",
  authorize("student"),
  validate(submitAssignmentSchema),
  submitAssignment
);

// Instructor view submissions for assignment
router.get(
  "/:id/submissions",
  authorize("instructor", "admin"),
  getSubmissionsByAssignment
);

// Submission detail & grading
router.get("/submissions/:submissionId", getSubmissionDetail);

router.post(
  "/submissions/:submissionId/grade",
  authorize("instructor", "admin"),
  validate(gradeSubmissionSchema),
  gradeSubmission
);

// Manual recheck endpoints
router.post(
  "/submissions/:submissionId/plagiarism-check",
  authorize("instructor", "admin"),
  triggerPlagiarismCheck
);

router.post(
  "/submissions/:submissionId/ai-evaluation",
  authorize("instructor", "admin"),
  triggerAiEvaluation
);

export default router;

