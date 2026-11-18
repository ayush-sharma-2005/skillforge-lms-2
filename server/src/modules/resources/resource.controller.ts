import type { Response } from "express";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";

import { Resource } from "./resource.model";
import { DownloadLog } from "./downloadLog.model";
import { Course } from "../courses/course.model";
import Lesson from "../lessons/lesson.model";
import Enrollment from "../enrollments/enrollment.model";

import {
  type CreateResourceInput,
  type UpdateResourceInput,
} from "./resource.validation";

import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import type { AuthRequest } from "../../middlewares/auth.middleware";

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return secret;
};

// CREATE COURSE RESOURCE — Instructor / Admin
export const createResource = asyncHandler(async (req, res) => {
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
    fileUrl,
    fileSize,
    fileType,
    isDownloadable = true,
  } = req.body as CreateResourceInput;

  const course = await Course.findById(courseId);
  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  const isOwner = course.instructor.toString() === userId;
  const isAdmin = authReq.userRole === "admin";
  if (!isOwner && !isAdmin) {
    throw new ApiError(403, "You can only add resources to your own courses");
  }

  if (lessonId) {
    const lesson = await Lesson.findOne({ _id: lessonId, course: courseId });
    if (!lesson) {
      throw new ApiError(404, "Lesson not found in this course");
    }
  }

  const resource = await Resource.create({
    course: courseId,
    lesson: lessonId || undefined,
    title,
    description,
    fileUrl,
    fileSize,
    fileType,
    isDownloadable,
    uploadedBy: userId,
  });

  res.status(201).json({
    success: true,
    message: "Resource created successfully",
    data: { resource },
  });
});

// GET COURSE RESOURCES — Enrolled Students / Instructors / Admins
export const getCourseResources = asyncHandler(async (req, res) => {
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
    const isEnrolled = await Enrollment.exists({
      student: userId,
      course: courseId,
      status: "active",
    });

    if (!isEnrolled) {
      throw new ApiError(
        403,
        "Active enrollment required to access course resources"
      );
    }
  }

  const filter: Record<string, unknown> = { course: courseId };
  if (!isInstructor && !isAdmin) {
    filter.isDownloadable = true;
  }

  const resources = await Resource.find(filter)
    .populate("lesson", "title order")
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: { resources },
  });
});

// UPDATE RESOURCE — Instructor / Admin
export const updateResource = asyncHandler(async (req, res) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;
  const { resourceId } = req.params;

  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

  if (!mongoose.isValidObjectId(resourceId)) {
    throw new ApiError(400, "Invalid resource ID");
  }

  const resource = await Resource.findById(resourceId);
  if (!resource) {
    throw new ApiError(404, "Resource not found");
  }

  const course = await Course.findById(resource.course);
  const isOwner = course && course.instructor.toString() === userId;
  const isAdmin = authReq.userRole === "admin";

  if (!isOwner && !isAdmin) {
    throw new ApiError(403, "You can only update resources for your own courses");
  }

  const updates = req.body as UpdateResourceInput;
  resource.set(updates);
  await resource.save();

  res.status(200).json({
    success: true,
    message: "Resource updated successfully",
    data: { resource },
  });
});

// DELETE RESOURCE — Instructor / Admin
export const deleteResource = asyncHandler(async (req, res) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;
  const { resourceId } = req.params;

  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

  if (!mongoose.isValidObjectId(resourceId)) {
    throw new ApiError(400, "Invalid resource ID");
  }

  const resource = await Resource.findById(resourceId);
  if (!resource) {
    throw new ApiError(404, "Resource not found");
  }

  const course = await Course.findById(resource.course);
  const isOwner = course && course.instructor.toString() === userId;
  const isAdmin = authReq.userRole === "admin";

  if (!isOwner && !isAdmin) {
    throw new ApiError(403, "You can only delete resources from your own courses");
  }

  await Promise.all([
    resource.deleteOne(),
    DownloadLog.deleteMany({ resource: resource._id }),
  ]);

  res.status(200).json({
    success: true,
    message: "Resource deleted successfully",
  });
});

// GENERATE SIGNED TIME-LIMITED DOWNLOAD TOKEN — Enrolled Students
export const generateDownloadToken = asyncHandler(async (req, res) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;
  const { resourceId } = req.params;

  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

  if (!mongoose.isValidObjectId(resourceId)) {
    throw new ApiError(400, "Invalid resource ID");
  }

  const resource = await Resource.findById(resourceId);
  if (!resource) {
    throw new ApiError(404, "Resource not found");
  }

  if (!resource.isDownloadable) {
    throw new ApiError(403, "This resource is not permitted for offline download");
  }

  const course = await Course.findById(resource.course);
  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  const isInstructor = course.instructor.toString() === userId;
  const isAdmin = authReq.userRole === "admin";

  if (!isInstructor && !isAdmin) {
    const isEnrolled = await Enrollment.exists({
      student: userId,
      course: course._id,
      status: "active",
    });

    if (!isEnrolled) {
      throw new ApiError(
        403,
        "Active course enrollment required to download resources"
      );
    }
  }

  // Token expires in 15 minutes (900 seconds)
  const expiresIn = "15m";
  const downloadToken = jwt.sign(
    {
      sub: userId,
      resId: resource._id.toString(),
      courseId: course._id.toString(),
      type: "resource_download",
    },
    getJwtSecret(),
    { expiresIn }
  );

  res.status(200).json({
    success: true,
    message: "Signed download token generated successfully",
    data: {
      downloadToken,
      downloadUrl: `/api/resources/download/${downloadToken}`,
      expiresInSeconds: 900,
      resource: {
        id: resource._id,
        title: resource.title,
        fileType: resource.fileType,
        fileSize: resource.fileSize,
      },
    },
  });
});

// DOWNLOAD RESOURCE WITH SIGNED TOKEN
export const downloadResourceWithToken = asyncHandler(async (req, res) => {
  const token = typeof req.params.token === "string" ? req.params.token : "";

  if (!token) {
    throw new ApiError(400, "Download token required");
  }

  let decoded: any;
  try {
    decoded = jwt.verify(token, getJwtSecret());
  } catch {
    throw new ApiError(401, "Invalid or expired download token");
  }

  if (
    typeof decoded !== "object" ||
    decoded.type !== "resource_download" ||
    !decoded.resId ||
    !decoded.sub
  ) {
    throw new ApiError(401, "Invalid download token payload");
  }

  const resource = await Resource.findById(decoded.resId);
  if (!resource) {
    throw new ApiError(404, "Resource no longer exists");
  }

  if (!resource.isDownloadable) {
    throw new ApiError(403, "Resource download has been revoked");
  }

  // Record download activity
  await Promise.all([
    DownloadLog.create({
      resource: resource._id,
      student: decoded.sub,
      course: resource.course,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    }),
    Resource.updateOne(
      { _id: resource._id },
      { $inc: { downloadCount: 1 } }
    ),
  ]);

  res.status(200).json({
    success: true,
    message: "Download authorized",
    data: {
      fileUrl: resource.fileUrl,
      title: resource.title,
      fileType: resource.fileType,
      fileSize: resource.fileSize,
      downloadCount: resource.downloadCount + 1,
    },
  });
});

// GET RESOURCE ANALYTICS — Instructor / Admin
export const getResourceAnalytics = asyncHandler(async (req, res) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;
  const courseId =
    typeof req.params.courseId === "string" ? req.params.courseId : "";

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

  const courseObjId = new mongoose.Types.ObjectId(courseId);

  const [resourceStats, recentLogs] = await Promise.all([
    Resource.find({ course: courseObjId })
      .select("title fileType fileSize isDownloadable downloadCount createdAt")
      .sort({ downloadCount: -1 }),

    DownloadLog.find({ course: courseObjId })
      .populate("student", "name email")
      .populate("resource", "title fileType")
      .sort({ downloadedAt: -1 })
      .limit(50),
  ]);

  const totalDownloads = resourceStats.reduce(
    (acc, curr) => acc + curr.downloadCount,
    0
  );

  res.status(200).json({
    success: true,
    data: {
      courseId,
      totalResources: resourceStats.length,
      totalDownloads,
      resources: resourceStats,
      recentDownloads: recentLogs,
    },
  });
});
