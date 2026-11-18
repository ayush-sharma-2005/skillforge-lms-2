import type { Response, NextFunction } from "express";
import mongoose from "mongoose";

import { Discussion } from "./discussion.model";
import { Course } from "../courses/course.model";
import Lesson from "../lessons/lesson.model";
import Enrollment from "../enrollments/enrollment.model";

import {
  type CreateDiscussionInput,
  type ReplyDiscussionInput,
  type UpdateDiscussionInput,
  type ReportDiscussionInput,
  type ModerateDiscussionInput,
  type DiscussionQueryInput,
} from "./discussion.validation";

import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import type { AuthRequest } from "../../middlewares/auth.middleware";

// Helper: verify user has access to course discussions
const verifyCourseAccess = async (
  userId: string,
  userRole: string | undefined,
  courseId: mongoose.Types.ObjectId | string
): Promise<{ isInstructor: boolean; isAdmin: boolean }> => {
  const course = await Course.findById(courseId);

  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  const isInstructor = course.instructor.toString() === userId;
  const isAdmin = userRole === "admin";

  if (isInstructor || isAdmin) {
    return { isInstructor, isAdmin };
  }

  const hasEnrollment = await Enrollment.exists({
    student: userId,
    course: courseId,
    status: "active",
  });

  if (!hasEnrollment) {
    throw new ApiError(
      403,
      "You must be enrolled in this course to participate in discussions"
    );
  }

  return { isInstructor: false, isAdmin: false };
};

// POST QUESTION UNDER LESSON
export const createQuestion = asyncHandler(async (req, res) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;
  const { lessonId } = req.params;

  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

  if (!mongoose.isValidObjectId(lessonId)) {
    throw new ApiError(400, "Invalid lesson ID");
  }

  const lesson = await Lesson.findById(lessonId);
  if (!lesson || !lesson.isPublished) {
    throw new ApiError(404, "Published lesson not found");
  }

  const { isInstructor } = await verifyCourseAccess(
    userId,
    authReq.userRole,
    lesson.course
  );

  const { content } = req.body as CreateDiscussionInput;

  const discussion = await Discussion.create({
    course: lesson.course,
    lesson: lesson._id,
    user: userId,
    content,
    parentDiscussionId: null,
    isInstructorReply: isInstructor,
  });

  const populated = await Discussion.findById(discussion._id).populate(
    "user",
    "name role"
  );

  res.status(201).json({
    success: true,
    message: "Question posted successfully",
    data: { discussion: populated },
  });
});

// REPLY TO A QUESTION
export const replyToQuestion = asyncHandler(async (req, res) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;
  const { discussionId } = req.params;

  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

  if (!mongoose.isValidObjectId(discussionId)) {
    throw new ApiError(400, "Invalid discussion ID");
  }

  const parent = await Discussion.findById(discussionId);
  if (!parent) {
    throw new ApiError(404, "Parent discussion not found");
  }

  const { isInstructor } = await verifyCourseAccess(
    userId,
    authReq.userRole,
    parent.course
  );

  const { content } = req.body as ReplyDiscussionInput;

  // Root parent discussion ID (keeps nesting 1 level deep for clean threading)
  const rootParentId = parent.parentDiscussionId || parent._id;

  const reply = await Discussion.create({
    course: parent.course,
    lesson: parent.lesson,
    user: userId,
    content,
    parentDiscussionId: rootParentId,
    isInstructorReply: isInstructor,
  });

  const populatedReply = await Discussion.findById(reply._id).populate(
    "user",
    "name role"
  );

  res.status(201).json({
    success: true,
    message: "Reply posted successfully",
    data: { reply: populatedReply },
  });
});

// GET LESSON DISCUSSIONS (Threaded with replies, pinned first)
export const getLessonDiscussions = asyncHandler(async (req, res) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;
  const { lessonId } = req.params;

  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

  if (!mongoose.isValidObjectId(lessonId)) {
    throw new ApiError(400, "Invalid lesson ID");
  }

  const lesson = await Lesson.findById(lessonId);
  if (!lesson || !lesson.isPublished) {
    throw new ApiError(404, "Published lesson not found");
  }

  const { isInstructor, isAdmin } = await verifyCourseAccess(
    userId,
    authReq.userRole,
    lesson.course
  );

  const query = req.query as unknown as DiscussionQueryInput;
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));

  // Students see active and flagged; only instructors/admins see hidden
  const filter: Record<string, unknown> = {
    lesson: lesson._id,
    parentDiscussionId: null,
  };

  if (!isInstructor && !isAdmin) {
    filter.status = { $ne: "hidden" };
  }

  const [questions, totalQuestions] = await Promise.all([
    Discussion.find(filter)
      .populate("user", "name role")
      .sort({ isPinned: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Discussion.countDocuments(filter),
  ]);

  const questionIds = questions.map((q) => q._id);

  // Fetch replies for these questions
  const replyFilter: Record<string, unknown> = {
    parentDiscussionId: { $in: questionIds },
  };

  if (!isInstructor && !isAdmin) {
    replyFilter.status = { $ne: "hidden" };
  }

  const replies = await Discussion.find(replyFilter)
    .populate("user", "name role")
    .sort({ createdAt: 1 })
    .lean();

  const repliesByParent = new Map<string, typeof replies>();
  for (const reply of replies) {
    const pId = reply.parentDiscussionId!.toString();
    if (!repliesByParent.has(pId)) {
      repliesByParent.set(pId, []);
    }
    repliesByParent.get(pId)!.push(reply);
  }

  const discussionsWithReplies = questions.map((q) => ({
    ...q,
    replyCount: repliesByParent.get(q._id.toString())?.length || 0,
    replies: repliesByParent.get(q._id.toString()) || [],
  }));

  res.status(200).json({
    success: true,
    data: {
      lessonId,
      discussions: discussionsWithReplies,
      pagination: {
        page,
        limit,
        total: totalQuestions,
        totalPages: Math.ceil(totalQuestions / limit),
      },
    },
  });
});

// UPDATE DISCUSSION (Author only)
export const updateDiscussion = asyncHandler(async (req, res) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;
  const { discussionId } = req.params;

  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

  if (!mongoose.isValidObjectId(discussionId)) {
    throw new ApiError(400, "Invalid discussion ID");
  }

  const discussion = await Discussion.findById(discussionId);
  if (!discussion) {
    throw new ApiError(404, "Discussion not found");
  }

  if (discussion.user.toString() !== userId) {
    throw new ApiError(403, "You can only edit your own discussions");
  }

  const { content } = req.body as UpdateDiscussionInput;
  discussion.content = content;
  await discussion.save();

  res.status(200).json({
    success: true,
    message: "Discussion updated successfully",
    data: { discussion },
  });
});

// DELETE DISCUSSION (Author, Course Instructor, or Admin)
export const deleteDiscussion = asyncHandler(async (req, res) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;
  const { discussionId } = req.params;

  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

  if (!mongoose.isValidObjectId(discussionId)) {
    throw new ApiError(400, "Invalid discussion ID");
  }

  const discussion = await Discussion.findById(discussionId);
  if (!discussion) {
    throw new ApiError(404, "Discussion not found");
  }

  const course = await Course.findById(discussion.course);
  const isAuthor = discussion.user.toString() === userId;
  const isInstructor = course && course.instructor.toString() === userId;
  const isAdmin = authReq.userRole === "admin";

  if (!isAuthor && !isInstructor && !isAdmin) {
    throw new ApiError(403, "You are not authorized to delete this discussion");
  }

  // Delete discussion and any child replies if it is a parent
  await Promise.all([
    discussion.deleteOne(),
    Discussion.deleteMany({ parentDiscussionId: discussion._id }),
  ]);

  res.status(200).json({
    success: true,
    message: "Discussion deleted successfully",
  });
});

// REPORT INAPPROPRIATE CONTENT
export const reportDiscussion = asyncHandler(async (req, res) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;
  const { discussionId } = req.params;

  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

  if (!mongoose.isValidObjectId(discussionId)) {
    throw new ApiError(400, "Invalid discussion ID");
  }

  const discussion = await Discussion.findById(discussionId);
  if (!discussion) {
    throw new ApiError(404, "Discussion not found");
  }

  const { reason } = req.body as ReportDiscussionInput;

  // Prevent multiple reports from same user
  const alreadyReported = discussion.reports.some(
    (r) => r.reportedBy.toString() === userId
  );

  if (alreadyReported) {
    throw new ApiError(409, "You have already reported this discussion");
  }

  discussion.reports.push({
    reportedBy: new mongoose.Types.ObjectId(userId),
    reason,
    createdAt: new Date(),
  });

  discussion.status = "flagged";
  await discussion.save();

  res.status(200).json({
    success: true,
    message: "Content reported successfully. An instructor or admin will review it.",
  });
});

// MODERATE DISCUSSION (Instructor or Admin)
export const moderateDiscussion = asyncHandler(async (req, res) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;
  const { discussionId } = req.params;

  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

  if (!mongoose.isValidObjectId(discussionId)) {
    throw new ApiError(400, "Invalid discussion ID");
  }

  const discussion = await Discussion.findById(discussionId);
  if (!discussion) {
    throw new ApiError(404, "Discussion not found");
  }

  const course = await Course.findById(discussion.course);
  const isInstructor = course && course.instructor.toString() === userId;
  const isAdmin = authReq.userRole === "admin";

  if (!isInstructor && !isAdmin) {
    throw new ApiError(403, "Moderation permissions required");
  }

  const { status, isPinned } = req.body as ModerateDiscussionInput;

  if (status !== undefined) {
    discussion.status = status;
  }

  if (isPinned !== undefined) {
    discussion.isPinned = isPinned;
  }

  await discussion.save();

  res.status(200).json({
    success: true,
    message: "Discussion moderated successfully",
    data: { discussion },
  });
});

// GET REPORTED / FLAGGED DISCUSSIONS (Instructor / Admin Queue)
export const getReportedDiscussions = asyncHandler(async (req, res) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;
  const { courseId } = req.params;

  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

  if (!mongoose.isValidObjectId(courseId)) {
    throw new ApiError(400, "Invalid course ID");
  }

  const course = await Course.findById(courseId);
  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  const isInstructor = course.instructor.toString() === userId;
  const isAdmin = authReq.userRole === "admin";

  if (!isInstructor && !isAdmin) {
    throw new ApiError(403, "Instructor or admin access required");
  }

  const flagged = await Discussion.find({
    course: courseId,
    status: "flagged",
  })
    .populate("user", "name email")
    .populate("lesson", "title order")
    .populate("reports.reportedBy", "name email")
    .sort({ updatedAt: -1 });

  res.status(200).json({
    success: true,
    data: { flaggedDiscussions: flagged },
  });
});

