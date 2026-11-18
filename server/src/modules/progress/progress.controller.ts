import type { Response, NextFunction } from "express";
import mongoose, { Types } from "mongoose";

import Progress from "./progress.model";
import Lesson from "../lessons/lesson.model";
import Enrollment from "../enrollments/enrollment.model";
import { Course } from "../courses/course.model";
import { checkLessonDripLock } from "../lessons/lesson.controller";

import { ApiError } from "../../utils/ApiError";
import type { AuthRequest } from "../../middlewares/auth.middleware";

// Safely get a string from Express route params
const getParamString = (
  value: string | string[] | undefined
): string | undefined => {
  return typeof value === "string" ? value : undefined;
};

// Check whether the student has an active enrollment
const hasActiveEnrollment = async (
  studentId: string,
  courseId: string
) => {
  return Enrollment.exists({
    student: studentId,
    course: courseId,
    status: "active",
    paymentStatus: { $in: ["free", "paid"] },
  });
};

// POST: Mark a lesson as completed
export const completeLesson = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const courseId = getParamString(req.params.courseId);
    const lessonId = getParamString(req.params.lessonId);
    const studentId = req.userId;

    if (!studentId) {
      throw new ApiError(401, "Authentication required");
    }

    if (
      !courseId ||
      !lessonId ||
      !mongoose.isValidObjectId(courseId) ||
      !mongoose.isValidObjectId(lessonId)
    ) {
      throw new ApiError(400, "Invalid course or lesson ID");
    }

    // Check whether the course exists and is published
    const course = await Course.findById(courseId);

    if (!course || !course.isPublished) {
      throw new ApiError(404, "Published course not found");
    }

    // Verify active enrollment
    const enrollment = await hasActiveEnrollment(
      studentId,
      courseId
    );

    if (!enrollment) {
      throw new ApiError(
        403,
        "Active course enrollment required"
      );
    }

    // Verify that the lesson belongs to this course
    const lesson = await Lesson.findOne({
      _id: lessonId,
      course: courseId,
      isPublished: true,
    });

    if (!lesson) {
      throw new ApiError(
        404,
        "Published lesson not found in this course"
      );
    }

    // Check if lesson is locked by drip rules
    const dripStatus = await checkLessonDripLock(lesson, studentId);
    if (dripStatus.isLocked) {
      throw new ApiError(
        403,
        `This lesson is currently locked according to course drip schedule and unlocks on ${dripStatus.availableAt?.toISOString()}`
      );
    }

    // Create progress or add the completed lesson.
    // $addToSet prevents duplicate lesson IDs.
    const progress = await Progress.findOneAndUpdate(
      {
        student: studentId,
        course: courseId,
      },
      {
        $addToSet: {
          completedLessons: new Types.ObjectId(lessonId),
        },
        $set: {
          lastAccessedAt: new Date(),
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    );

    // Count all published lessons in this course
    const totalLessons = await Lesson.countDocuments({
      course: courseId,
      isPublished: true,
    });

    const completedCount = progress.completedLessons.length;

    const percentage =
      totalLessons === 0
        ? 0
        : Math.round((completedCount / totalLessons) * 100);

    res.status(200).json({
      success: true,
      message: "Lesson marked as completed",
      data: {
        courseId,
        lessonId,
        completedLessons: completedCount,
        totalLessons,
        percentage,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET: Get logged-in student's progress for a course
export const getCourseProgress = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const courseId = getParamString(req.params.courseId);
    const studentId = req.userId;

    if (!studentId) {
      throw new ApiError(401, "Authentication required");
    }

    if (
      !courseId ||
      !mongoose.isValidObjectId(courseId)
    ) {
      throw new ApiError(400, "Invalid course ID");
    }

    // Check whether the course exists and is published
    const course = await Course.findById(courseId);

    if (!course || !course.isPublished) {
      throw new ApiError(404, "Published course not found");
    }

    // Verify active enrollment
    const enrollment = await hasActiveEnrollment(
      studentId,
      courseId
    );

    if (!enrollment) {
      throw new ApiError(
        403,
        "Active course enrollment required"
      );
    }

    // Fetch progress and published lesson count
    const [progress, totalLessons] = await Promise.all([
      Progress.findOne({
        student: studentId,
        course: courseId,
      }),
      Lesson.countDocuments({
        course: courseId,
        isPublished: true,
      }),
    ]);

    const completedLessons = progress?.completedLessons ?? [];

    const percentage =
      totalLessons === 0
        ? 0
        : Math.round(
            (completedLessons.length / totalLessons) * 100
          );

    res.status(200).json({
      success: true,
      data: {
        courseId,
        completedLessons: completedLessons.length,
        totalLessons,
        percentage,
        completedLessonIds: completedLessons,
        lastAccessedAt: progress?.lastAccessedAt ?? null,
      },
    });
  } catch (error) {
    next(error);
  }
};
