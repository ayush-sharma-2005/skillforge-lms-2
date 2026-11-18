import { Router } from "express";

import {
  assignPeerReviews,
  getMyAssignedReviews,
  getReceivedReviewsForSubmission,
  getPeerReviewById,
  addCodeComment,
  submitPeerReview,
  getAssignmentPeerReviews,
} from "./peerReview.controller";

import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";

import {
  assignPeerReviewsSchema,
  addCodeCommentSchema,
  submitPeerReviewSchema,
} from "./peerReview.validation";

const router = Router();

router.use(authenticate);

// Instructor assigns peer reviews
router.post(
  "/assign",
  authorize("instructor", "admin"),
  validate(assignPeerReviewsSchema),
  assignPeerReviews
);

// Student reviews to complete
router.get("/assigned", authorize("student"), getMyAssignedReviews);

// Reviews received for a submission
router.get("/received/:submissionId", getReceivedReviewsForSubmission);

// Instructor view all reviews for an assignment
router.get(
  "/assignment/:assignmentId",
  authorize("instructor", "admin"),
  getAssignmentPeerReviews
);

// Single review detail
router.get("/:id", getPeerReviewById);

// Add code comment
router.post(
  "/:id/comments",
  authorize("student"),
  validate(addCodeCommentSchema),
  addCodeComment
);

// Submit completed review
router.post(
  "/:id/review",
  authorize("student"),
  validate(submitPeerReviewSchema),
  submitPeerReview
);

export default router;

