import type { Response } from "express";
import mongoose from "mongoose";

import { Assignment } from "./assignment.model";
import { Submission } from "./submission.model";
import { Course } from "../courses/course.model";
import Lesson from "../lessons/lesson.model";
import Enrollment from "../enrollments/enrollment.model";

import {
  type CreateAssignmentInput,
  type UpdateAssignmentInput,
  type SubmitAssignmentInput,
  type GradeSubmissionInput,
} from "./assignment.validation";

import { runPlagiarismCheck } from "./plagiarism.service";
import { evaluateSubmissionWithAi } from "./aiEvaluation.service";

import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import type { AuthRequest } from "../../middlewares/auth.middleware";

// CREATE ASSIGNMENT — Instructor of course or Admin
export const createAssignment = asyncHandler(async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;

  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

  const {
    courseId,
    lessonId,
    title,
    description,
    assignmentType = "text",
    allowedLanguages,
    dueDate,
    maxScore = 100,
    rubrics = [],
    similarityThreshold = 40,
    isPeerReviewEnabled = false,
    peerReviewsPerSubmission = 2,
    peerReviewDeadline,
    aiEvaluationEnabled = true,
    isPublished = true,
  } = req.body as CreateAssignmentInput;

  const course = await Course.findById(courseId);
  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  const isOwner = course.instructor.toString() === userId;
  const isAdmin = authReq.userRole === "admin";
  if (!isOwner && !isAdmin) {
    throw new ApiError(403, "You can only create assignments for your own courses");
  }

  if (lessonId) {
    const lesson = await Lesson.findOne({ _id: lessonId, course: courseId });
    if (!lesson) {
      throw new ApiError(404, "Lesson not found in this course");
    }
  }

  const assignment = await Assignment.create({
    course: courseId,
    lesson: lessonId || undefined,
    instructor: userId,
    title,
    description,
    assignmentType,
    allowedLanguages: allowedLanguages || [],
    dueDate: new Date(dueDate),
    maxScore,
    rubrics,
    similarityThreshold,
    isPeerReviewEnabled,
    peerReviewsPerSubmission,
    peerReviewDeadline: peerReviewDeadline ? new Date(peerReviewDeadline) : undefined,
    aiEvaluationEnabled,
    isPublished,
  });

  res.status(201).json({
    success: true,
    message: "Assignment created successfully",
    data: assignment,
  });
});

// GET ASSIGNMENTS FOR A COURSE
export const getAssignmentsByCourse = asyncHandler(async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;
  const courseId = typeof req.params.courseId === "string" ? req.params.courseId : "";

  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    throw new ApiError(400, "Invalid course ID");
  }

  const course = await Course.findById(courseId);
  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  const isInstructor = course.instructor.toString() === userId;
  const isAdmin = authReq.userRole === "admin";

  if (!isInstructor && !isAdmin) {
    // Check student enrollment
    const isEnrolled = await Enrollment.findOne({
      course: courseId,
      student: userId,
      status: "active",
    });

    if (!isEnrolled) {
      throw new ApiError(403, "You must be enrolled in this course to view assignments");
    }
  }

  const filter: Record<string, any> = { course: courseId };
  if (!isInstructor && !isAdmin) {
    filter.isPublished = true;
  }

  const assignments = await Assignment.find(filter)
    .populate("lesson", "title")
    .sort({ dueDate: 1 });

  res.status(200).json({
    success: true,
    data: assignments,
  });
});

// GET ASSIGNMENT DETAIL
export const getAssignmentById = asyncHandler(async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;
  const assignmentId = typeof req.params.id === "string" ? req.params.id : "";

  if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
    throw new ApiError(400, "Invalid assignment ID");
  }

  const assignment = await Assignment.findById(assignmentId)
    .populate("course", "title instructor")
    .populate("lesson", "title");

  if (!assignment) {
    throw new ApiError(404, "Assignment not found");
  }

  let mySubmission = null;
  if (userId) {
    mySubmission = await Submission.findOne({
      assignment: assignment._id,
      student: userId,
    });
  }

  res.status(200).json({
    success: true,
    data: {
      assignment,
      mySubmission,
    },
  });
});

// UPDATE ASSIGNMENT — Instructor or Admin
export const updateAssignment = asyncHandler(async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;
  const assignmentId = typeof req.params.id === "string" ? req.params.id : "";

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
    throw new ApiError(403, "You can only update your own assignments");
  }

  const updates = req.body as UpdateAssignmentInput;
  if (updates.dueDate) {
    updates.dueDate = new Date(updates.dueDate) as any;
  }
  if (updates.peerReviewDeadline) {
    updates.peerReviewDeadline = new Date(updates.peerReviewDeadline) as any;
  }

  const updatedAssignment = await Assignment.findByIdAndUpdate(
    assignmentId,
    { $set: updates },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    success: true,
    message: "Assignment updated successfully",
    data: updatedAssignment,
  });
});

// DELETE ASSIGNMENT — Instructor or Admin
export const deleteAssignment = asyncHandler(async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;
  const assignmentId = typeof req.params.id === "string" ? req.params.id : "";

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
    throw new ApiError(403, "You can only delete your own assignments");
  }

  await Assignment.findByIdAndDelete(assignmentId);
  await Submission.deleteMany({ assignment: assignmentId });

  res.status(200).json({
    success: true,
    message: "Assignment and related submissions deleted successfully",
  });
});

// SUBMIT ASSIGNMENT — Student
export const submitAssignment = asyncHandler(async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;
  const assignmentId = typeof req.params.id === "string" ? req.params.id : "";

  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

  if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
    throw new ApiError(400, "Invalid assignment ID");
  }

  const assignment = await Assignment.findById(assignmentId);
  if (!assignment) {
    throw new ApiError(404, "Assignment not found");
  }

  // Verify enrollment
  const isEnrolled = await Enrollment.findOne({
    course: assignment.course,
    student: userId,
    status: "active",
  });

  if (!isEnrolled) {
    throw new ApiError(403, "You must be enrolled in this course to submit assignments");
  }

  // Check deadline
  if (new Date() > new Date(assignment.dueDate)) {
    throw new ApiError(400, "The due date for this assignment has passed");
  }

  const { content, language } = req.body as SubmitAssignmentInput;

  if (assignment.assignmentType === "code" && assignment.allowedLanguages && assignment.allowedLanguages.length > 0) {
    if (!language || !assignment.allowedLanguages.includes(language.toLowerCase())) {
      throw new ApiError(
        400,
        `Language must be one of: ${assignment.allowedLanguages.join(", ")}`
      );
    }
  }

  let submission = await Submission.findOne({
    assignment: assignment._id,
    student: userId,
  });

  if (submission) {
    // Update existing submission if before deadline
    submission.content = content;
    if (language) submission.language = language;
    submission.submittedAt = new Date();
    submission.status = "submitted";
    await submission.save();
  } else {
    submission = await Submission.create({
      assignment: assignment._id,
      course: assignment.course,
      student: userId,
      content,
      language,
      submittedAt: new Date(),
      status: "submitted",
    });
  }

  // Run Plagiarism Check
  await runPlagiarismCheck(submission._id);

  // Run AI Evaluation if enabled on assignment
  if (assignment.aiEvaluationEnabled) {
    await evaluateSubmissionWithAi(submission._id.toString());
  }

  // Fetch updated submission with reports
  const updatedSubmission = await Submission.findById(submission._id);

  res.status(200).json({
    success: true,
    message: "Assignment submitted successfully",
    data: updatedSubmission,
  });
});

// GET SUBMISSIONS FOR AN ASSIGNMENT — Instructor / Admin
export const getSubmissionsByAssignment = asyncHandler(async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;
  const assignmentId = typeof req.params.id === "string" ? req.params.id : "";

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
    throw new ApiError(403, "Only the course instructor can view all submissions");
  }

  const flaggedOnly = req.query.flagged === "true";
  const filter: Record<string, any> = { assignment: assignmentId };

  if (flaggedOnly) {
    filter["similarityReport.flaggedForReview"] = true;
  }

  const submissions = await Submission.find(filter)
    .populate("student", "name email")
    .sort({ submittedAt: -1 });

  res.status(200).json({
    success: true,
    count: submissions.length,
    data: submissions,
  });
});

// GET SUBMISSION DETAIL — Student owner, Instructor of course, or Admin
export const getSubmissionDetail = asyncHandler(async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;
  const submissionId = typeof req.params.submissionId === "string" ? req.params.submissionId : "";

  if (!mongoose.Types.ObjectId.isValid(submissionId)) {
    throw new ApiError(400, "Invalid submission ID");
  }

  const submission = await Submission.findById(submissionId)
    .populate("student", "name email")
    .populate("assignment", "title maxScore rubrics similarityThreshold instructor");

  if (!submission) {
    throw new ApiError(404, "Submission not found");
  }

  const isStudent = submission.student._id.toString() === userId;
  const isInstructor = (submission.assignment as any)?.instructor?.toString() === userId;
  const isAdmin = authReq.userRole === "admin";

  if (!isStudent && !isInstructor && !isAdmin) {
    throw new ApiError(403, "Access denied to this submission");
  }

  res.status(200).json({
    success: true,
    data: submission,
  });
});

// GRADE SUBMISSION — Instructor or Admin
export const gradeSubmission = asyncHandler(async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;
  const submissionId = typeof req.params.submissionId === "string" ? req.params.submissionId : "";

  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

  if (!mongoose.Types.ObjectId.isValid(submissionId)) {
    throw new ApiError(400, "Invalid submission ID");
  }

  const submission = await Submission.findById(submissionId).populate("assignment");
  if (!submission) {
    throw new ApiError(404, "Submission not found");
  }

  const assignment = submission.assignment as any;
  const isOwner = assignment?.instructor?.toString() === userId;
  const isAdmin = authReq.userRole === "admin";
  if (!isOwner && !isAdmin) {
    throw new ApiError(403, "Only the course instructor or admin can grade this submission");
  }

  const { score, feedback, rubricScores, useAiScore } = req.body as GradeSubmissionInput;

  let finalScore: number;
  let finalFeedback: string;
  let finalRubricScores = rubricScores || [];

  if (useAiScore) {
    if (!submission.aiEvaluation) {
      throw new ApiError(400, "No AI evaluation available to approve");
    }
    finalScore = submission.aiEvaluation.suggestedScore;
    finalFeedback = feedback || submission.aiEvaluation.feedback;
    finalRubricScores =
      finalRubricScores.length > 0
        ? finalRubricScores
        : submission.aiEvaluation.rubricScores;
    submission.aiEvaluation.status = "approved";
  } else {
    if (typeof score !== "number") {
      throw new ApiError(400, "Score is required when not adopting AI score");
    }
    if (!feedback) {
      throw new ApiError(400, "Feedback is required when grading");
    }
    finalScore = score;
    finalFeedback = feedback;
    if (submission.aiEvaluation) {
      submission.aiEvaluation.status = "overridden";
    }
  }

  submission.grade = {
    score: finalScore,
    feedback: finalFeedback,
    rubricScores: finalRubricScores,
    gradedBy: new mongoose.Types.ObjectId(userId),
    gradedAt: new Date(),
  };

  submission.status = "graded";
  await submission.save();

  res.status(200).json({
    success: true,
    message: "Submission graded successfully",
    data: submission,
  });
});

// RECHECK PLAGIARISM — Instructor or Admin
export const triggerPlagiarismCheck = asyncHandler(async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;
  const submissionId = typeof req.params.submissionId === "string" ? req.params.submissionId : "";

  const submission = await Submission.findById(submissionId).populate("assignment");
  if (!submission) {
    throw new ApiError(404, "Submission not found");
  }

  const assignment = submission.assignment as any;
  const isOwner = assignment?.instructor?.toString() === userId;
  const isAdmin = authReq.userRole === "admin";
  if (!isOwner && !isAdmin) {
    throw new ApiError(403, "Access denied");
  }

  const report = await runPlagiarismCheck(submission._id);

  res.status(200).json({
    success: true,
    message: "Plagiarism check completed",
    data: report,
  });
});

// TRIGGER AI EVALUATION — Instructor or Admin
export const triggerAiEvaluation = asyncHandler(async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;
  const submissionId = typeof req.params.submissionId === "string" ? req.params.submissionId : "";

  const submission = await Submission.findById(submissionId).populate("assignment");
  if (!submission) {
    throw new ApiError(404, "Submission not found");
  }

  const assignment = submission.assignment as any;
  const isOwner = assignment?.instructor?.toString() === userId;
  const isAdmin = authReq.userRole === "admin";
  if (!isOwner && !isAdmin) {
    throw new ApiError(403, "Access denied");
  }

  const evaluation = await evaluateSubmissionWithAi(submission._id.toString());

  res.status(200).json({
    success: true,
    message: "AI evaluation completed",
    data: evaluation,
  });
});

