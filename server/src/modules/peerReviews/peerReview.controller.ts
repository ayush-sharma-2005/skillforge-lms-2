import type { Response } from "express";
import mongoose from "mongoose";

import { PeerReview } from "./peerReview.model";
import { Assignment } from "../assignments/assignment.model";
import { Submission } from "../assignments/submission.model";

import {
  type AssignPeerReviewsInput,
  type AddCodeCommentInput,
  type SubmitPeerReviewInput,
} from "./peerReview.validation";

import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import type { AuthRequest } from "../../middlewares/auth.middleware";

// ASSIGN PEER REVIEWS — Instructor / Admin
export const assignPeerReviews = asyncHandler(async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;

  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

  const { assignmentId, deadline } = req.body as AssignPeerReviewsInput;

  const assignment = await Assignment.findById(assignmentId);
  if (!assignment) {
    throw new ApiError(404, "Assignment not found");
  }

  const isOwner = assignment.instructor.toString() === userId;
  const isAdmin = authReq.userRole === "admin";
  if (!isOwner && !isAdmin) {
    throw new ApiError(403, "Only the course instructor or admin can assign peer reviews");
  }

  const submissions = await Submission.find({ assignment: assignmentId });
  if (submissions.length < 2) {
    throw new ApiError(
      400,
      `At least 2 submissions are required to assign peer reviews (found ${submissions.length})`
    );
  }

  const reviewDeadline = deadline
    ? new Date(deadline)
    : assignment.peerReviewDeadline ||
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days default

  const reviewsPerStudent = Math.min(
    assignment.peerReviewsPerSubmission || 2,
    submissions.length - 1
  );

  const createdReviews = [];
  const n = submissions.length;

  for (let i = 0; i < n; i++) {
    const currentSub = submissions[i];
    const authorId = currentSub.student.toString();

    // Round-robin assignment of distinct peers (offset by 1, 2, ... k)
    for (let step = 1; step <= reviewsPerStudent; step++) {
      const reviewerIdx = (i + step) % n;
      const reviewerSub = submissions[reviewerIdx];
      const reviewerId = reviewerSub.student.toString();

      // Guard: strictly ensure reviewer is not the author
      if (reviewerId === authorId) {
        continue;
      }

      // Check if already assigned
      const existing = await PeerReview.findOne({
        submission: currentSub._id,
        reviewer: reviewerSub.student,
      });

      if (!existing) {
        const review = await PeerReview.create({
          assignment: assignment._id,
          submission: currentSub._id,
          course: assignment.course,
          author: currentSub.student,
          reviewer: reviewerSub.student,
          status: "assigned",
          deadline: reviewDeadline,
          codeComments: [],
        });
        createdReviews.push(review);
      }
    }
  }

  res.status(200).json({
    success: true,
    message: `Assigned ${createdReviews.length} peer reviews successfully`,
    count: createdReviews.length,
    data: createdReviews,
  });
});

// GET REVIEWS ASSIGNED TO ME TO COMPLETE — Student
export const getMyAssignedReviews = asyncHandler(async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;

  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

  const reviews = await PeerReview.find({ reviewer: userId })
    .populate("assignment", "title description dueDate peerReviewDeadline maxScore")
    .populate("submission", "content language submittedAt")
    .populate("author", "name")
    .sort({ deadline: 1 });

  res.status(200).json({
    success: true,
    count: reviews.length,
    data: reviews,
  });
});

// GET PEER REVIEWS RECEIVED FOR A SUBMISSION — Student Author, Instructor, or Admin
export const getReceivedReviewsForSubmission = asyncHandler(
  async (req, res: Response) => {
    const authReq = req as AuthRequest;
    const userId = authReq.userId;
    const submissionId =
      typeof req.params.submissionId === "string" ? req.params.submissionId : "";

    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      throw new ApiError(400, "Invalid submission ID");
    }

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      throw new ApiError(404, "Submission not found");
    }

    const assignment = await Assignment.findById(submission.assignment);
    const isAuthor = submission.student.toString() === userId;
    const isInstructor = assignment?.instructor.toString() === userId;
    const isAdmin = authReq.userRole === "admin";

    if (!isAuthor && !isInstructor && !isAdmin) {
      throw new ApiError(403, "Access denied to peer reviews for this submission");
    }

    const reviews = await PeerReview.find({
      submission: submissionId,
      status: "completed",
    })
      .populate("reviewer", "name")
      .select("-submission");

    res.status(200).json({
      success: true,
      count: reviews.length,
      data: reviews,
    });
  }
);

// GET SINGLE PEER REVIEW DETAIL
export const getPeerReviewById = asyncHandler(async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;
  const reviewId = typeof req.params.id === "string" ? req.params.id : "";

  if (!mongoose.Types.ObjectId.isValid(reviewId)) {
    throw new ApiError(400, "Invalid review ID");
  }

  const review = await PeerReview.findById(reviewId)
    .populate("assignment", "title description maxScore allowedLanguages")
    .populate("submission", "content language submittedAt")
    .populate("reviewer", "name")
    .populate("author", "name");

  if (!review) {
    throw new ApiError(404, "Peer review not found");
  }

  const isReviewer = review.reviewer._id.toString() === userId;
  const isAuthor = review.author._id.toString() === userId;
  const isAdmin = authReq.userRole === "admin";

  if (!isReviewer && !isAuthor && !isAdmin) {
    throw new ApiError(403, "Access denied to this review");
  }

  res.status(200).json({
    success: true,
    data: review,
  });
});

// ADD INLINE CODE COMMENT — Reviewer Student
export const addCodeComment = asyncHandler(async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;
  const reviewId = typeof req.params.id === "string" ? req.params.id : "";

  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

  if (!mongoose.Types.ObjectId.isValid(reviewId)) {
    throw new ApiError(400, "Invalid review ID");
  }

  const review = await PeerReview.findById(reviewId);
  if (!review) {
    throw new ApiError(404, "Peer review not found");
  }

  if (review.reviewer.toString() !== userId) {
    throw new ApiError(403, "Only the assigned reviewer can add code comments");
  }

  // Prevent author from reviewing own submission
  if (review.author.toString() === userId) {
    throw new ApiError(403, "Students cannot review their own submissions");
  }

  // Check deadline
  if (new Date() > new Date(review.deadline)) {
    review.status = "expired";
    await review.save();
    throw new ApiError(400, "The deadline for this peer review has expired");
  }

  const { line, comment } = req.body as AddCodeCommentInput;

  review.codeComments.push({
    line,
    comment,
    createdAt: new Date(),
  });

  if (review.status === "assigned") {
    review.status = "in_progress";
  }

  await review.save();

  res.status(200).json({
    success: true,
    message: "Code comment added successfully",
    data: review,
  });
});

// SUBMIT COMPLETED PEER REVIEW — Reviewer Student
export const submitPeerReview = asyncHandler(async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;
  const reviewId = typeof req.params.id === "string" ? req.params.id : "";

  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

  if (!mongoose.Types.ObjectId.isValid(reviewId)) {
    throw new ApiError(400, "Invalid review ID");
  }

  const review = await PeerReview.findById(reviewId);
  if (!review) {
    throw new ApiError(404, "Peer review not found");
  }

  if (review.reviewer.toString() !== userId) {
    throw new ApiError(403, "Only the assigned reviewer can submit this review");
  }

  // Prevent author from reviewing own submission
  if (review.author.toString() === userId) {
    throw new ApiError(403, "Students cannot review their own submissions");
  }

  // Check deadline
  if (new Date() > new Date(review.deadline)) {
    review.status = "expired";
    await review.save();
    throw new ApiError(400, "The deadline for this peer review has expired");
  }

  const { score, feedback, codeComments } = req.body as SubmitPeerReviewInput;

  if (codeComments && codeComments.length > 0) {
    for (const c of codeComments) {
      review.codeComments.push({
        line: c.line,
        comment: c.comment,
        createdAt: new Date(),
      });
    }
  }

  if (typeof score === "number") {
    review.score = score;
  }
  review.feedback = feedback;
  review.status = "completed";
  review.submittedAt = new Date();

  await review.save();

  res.status(200).json({
    success: true,
    message: "Peer review submitted successfully",
    data: review,
  });
});

// GET ALL PEER REVIEWS FOR AN ASSIGNMENT — Instructor / Admin
export const getAssignmentPeerReviews = asyncHandler(async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;
  const assignmentId = typeof req.params.assignmentId === "string" ? req.params.assignmentId : "";

  if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
    throw new ApiError(400, "Invalid assignment ID");
  }

  const assignment = await Assignment.findById(assignmentId);
  if (!assignment) {
    throw new ApiError(404, "Assignment not found");
  }

  const isOwner = assignment.instructor.toString() === userId;
  const isAdmin = authReq.userRole === "admin";
  if (!isOwner && !isAdmin) {
    throw new ApiError(403, "Only the course instructor or admin can view all peer reviews");
  }

  const reviews = await PeerReview.find({ assignment: assignmentId })
    .populate("reviewer", "name email")
    .populate("author", "name email")
    .sort({ createdAt: -1 });

  const total = reviews.length;
  const completed = reviews.filter((r) => r.status === "completed").length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  res.status(200).json({
    success: true,
    data: {
      total,
      completed,
      completionRate,
      reviews,
    },
  });
});

