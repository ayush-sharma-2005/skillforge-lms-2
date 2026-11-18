import type { Response } from "express";
import mongoose from "mongoose";

import { CourseVersion } from "./courseVersion.model";
import { Course } from "../courses/course.model";
import Lesson from "../lessons/lesson.model";
import Enrollment from "../enrollments/enrollment.model";

import { type CreateCourseVersionInput } from "./courseVersion.validation";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import type { AuthRequest } from "../../middlewares/auth.middleware";

// CREATE NEW COURSE VERSION SNAPSHOT — Instructor / Admin
export const createCourseVersion = asyncHandler(async (req, res) => {
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

  const isOwner = course.instructor.toString() === userId;
  const isAdmin = authReq.userRole === "admin";
  if (!isOwner && !isAdmin) {
    throw new ApiError(403, "You can only version your own courses");
  }

  const { version, changelog } = req.body as CreateCourseVersionInput;

  // Check if version string already exists for this course
  const existingVersion = await CourseVersion.findOne({
    course: courseId,
    version,
  });

  if (existingVersion) {
    throw new ApiError(
      409,
      `Version '${version}' already exists for this course. Please specify a unique version identifier.`
    );
  }

  // Fetch current published lessons
  const lessons = await Lesson.find({
    course: course._id,
    isPublished: true,
  }).sort({ order: 1 });

  const existingVersionsCount = await CourseVersion.countDocuments({
    course: courseId,
  });

  // Mark all previous versions as not current
  await CourseVersion.updateMany(
    { course: courseId },
    { $set: { isCurrent: false } }
  );

  const lessonSnapshots = lessons.map((l) => ({
    lessonId: l._id as mongoose.Types.ObjectId,
    title: l.title,
    description: l.description,
    videoUrl: l.videoUrl,
    duration: l.duration,
    order: l.order,
    dripType: l.dripType,
    transcript: l.transcript,
    captions: (l.captions || []).map((c) => ({
      language: c.language,
      label: c.label,
      url: c.url,
    })),
  }));

  const courseVersion = await CourseVersion.create({
    course: course._id,
    version,
    versionNumber: existingVersionsCount + 1,
    changelog,
    createdBy: userId,
    isCurrent: true,
    snapshot: {
      title: course.title,
      description: course.description,
      shortDescription: course.shortDescription,
      category: course.category,
      level: course.level,
      price: course.price,
      language: course.language,
      requirements: course.requirements,
      learningOutcomes: course.learningOutcomes,
      lessons: lessonSnapshots,
    },
  });

  res.status(201).json({
    success: true,
    message: `Course version ${version} created and snapshotted successfully`,
    data: { courseVersion },
  });
});

// GET ALL VERSIONS FOR A COURSE
export const getCourseVersions = asyncHandler(async (req, res) => {
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
    const isEnrolled = await Enrollment.exists({
      student: userId,
      course: courseId,
      status: "active",
    });

    if (!isEnrolled) {
      throw new ApiError(
        403,
        "Active enrollment required to view course version history"
      );
    }
  }

  const versions = await CourseVersion.find({ course: courseId })
    .populate("createdBy", "name role")
    .sort({ versionNumber: -1 })
    .lean();

  const formattedVersions = versions.map((v) => ({
    id: v._id,
    version: v.version,
    versionNumber: v.versionNumber,
    changelog: v.changelog,
    isCurrent: v.isCurrent,
    createdAt: v.createdAt,
    createdBy: v.createdBy,
    totalLessons: v.snapshot.lessons.length,
    totalDurationSeconds: v.snapshot.lessons.reduce(
      (sum, l) => sum + l.duration,
      0
    ),
  }));

  res.status(200).json({
    success: true,
    data: {
      courseId,
      versions: formattedVersions,
    },
  });
});

// GET SINGLE VERSION SNAPSHOT DETAILS
export const getCourseVersionDetail = asyncHandler(async (req, res) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;
  const versionId =
    typeof req.params.versionId === "string" ? req.params.versionId : "";

  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

  if (!mongoose.isValidObjectId(versionId)) {
    throw new ApiError(400, "Invalid version ID");
  }

  const courseVersion = await CourseVersion.findById(versionId).populate(
    "createdBy",
    "name role"
  );

  if (!courseVersion) {
    throw new ApiError(404, "Course version not found");
  }

  const course = await Course.findById(courseVersion.course);
  const isInstructor = course && course.instructor.toString() === userId;
  const isAdmin = authReq.userRole === "admin";

  if (!isInstructor && !isAdmin) {
    const isEnrolled = await Enrollment.exists({
      student: userId,
      course: courseVersion.course,
      status: "active",
    });

    if (!isEnrolled) {
      throw new ApiError(
        403,
        "Active enrollment required to access version snapshot"
      );
    }
  }

  res.status(200).json({
    success: true,
    data: { courseVersion },
  });
});

// COMPARE TWO VERSIONS (Generate Diff Report)
export const compareCourseVersions = asyncHandler(async (req, res) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;
  const versionId1 =
    typeof req.params.versionId1 === "string" ? req.params.versionId1 : "";
  const versionId2 =
    typeof req.params.versionId2 === "string" ? req.params.versionId2 : "";

  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

  if (
    !mongoose.isValidObjectId(versionId1) ||
    !mongoose.isValidObjectId(versionId2)
  ) {
    throw new ApiError(400, "Invalid version IDs provided");
  }

  const [v1, v2] = await Promise.all([
    CourseVersion.findById(versionId1),
    CourseVersion.findById(versionId2),
  ]);

  if (!v1 || !v2) {
    throw new ApiError(404, "One or both course versions not found");
  }

  if (v1.course.toString() !== v2.course.toString()) {
    throw new ApiError(400, "Cannot compare versions from different courses");
  }

  const course = await Course.findById(v1.course);
  const isInstructor = course && course.instructor.toString() === userId;
  const isAdmin = authReq.userRole === "admin";

  if (!isInstructor && !isAdmin) {
    const isEnrolled = await Enrollment.exists({
      student: userId,
      course: v1.course,
      status: "active",
    });

    if (!isEnrolled) {
      throw new ApiError(403, "Access denied to version comparison");
    }
  }

  // Metadata changes
  const metadataChanges: Record<string, { from: any; to: any }> = {};
  if (v1.snapshot.title !== v2.snapshot.title) {
    metadataChanges.title = { from: v1.snapshot.title, to: v2.snapshot.title };
  }
  if (v1.snapshot.price !== v2.snapshot.price) {
    metadataChanges.price = { from: v1.snapshot.price, to: v2.snapshot.price };
  }
  if (v1.snapshot.level !== v2.snapshot.level) {
    metadataChanges.level = { from: v1.snapshot.level, to: v2.snapshot.level };
  }

  // Lesson diffs
  const v1LessonsMap = new Map(
    v1.snapshot.lessons.map((l) => [l.lessonId.toString(), l])
  );
  const v2LessonsMap = new Map(
    v2.snapshot.lessons.map((l) => [l.lessonId.toString(), l])
  );

  const addedLessons: typeof v2.snapshot.lessons = [];
  const removedLessons: typeof v1.snapshot.lessons = [];
  const modifiedLessons: Array<{
    lessonId: mongoose.Types.ObjectId;
    title: string;
    changes: Record<string, { from: any; to: any }>;
  }> = [];

  for (const [id, l2] of v2LessonsMap) {
    if (!v1LessonsMap.has(id)) {
      addedLessons.push(l2);
    } else {
      const l1 = v1LessonsMap.get(id)!;
      const changes: Record<string, { from: any; to: any }> = {};

      if (l1.title !== l2.title) {
        changes.title = { from: l1.title, to: l2.title };
      }
      if (l1.duration !== l2.duration) {
        changes.duration = { from: l1.duration, to: l2.duration };
      }
      if (l1.order !== l2.order) {
        changes.order = { from: l1.order, to: l2.order };
      }

      if (Object.keys(changes).length > 0) {
        modifiedLessons.push({
          lessonId: l2.lessonId,
          title: l2.title,
          changes,
        });
      }
    }
  }

  for (const [id, l1] of v1LessonsMap) {
    if (!v2LessonsMap.has(id)) {
      removedLessons.push(l1);
    }
  }

  res.status(200).json({
    success: true,
    data: {
      fromVersion: {
        id: v1._id,
        version: v1.version,
        versionNumber: v1.versionNumber,
      },
      toVersion: {
        id: v2._id,
        version: v2.version,
        versionNumber: v2.versionNumber,
      },
      diff: {
        metadataChanges,
        addedLessonsCount: addedLessons.length,
        addedLessons,
        removedLessonsCount: removedLessons.length,
        removedLessons,
        modifiedLessonsCount: modifiedLessons.length,
        modifiedLessons,
      },
    },
  });
});
