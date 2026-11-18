import type { Response, NextFunction } from "express";
import mongoose from "mongoose";

import Enrollment from "../enrollments/enrollment.model";
import Progress from "../progress/progress.model";
import Lesson from "../lessons/lesson.model";


import { ApiError } from "../../utils/ApiError";
import type { AuthRequest } from "../../middlewares/auth.middleware";

// Get Student Dashboard
export const getStudentDashboard = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const studentId = req.userId;

    if (!studentId) {
      throw new ApiError(401, "Authentication required");
    }

    if (!mongoose.isValidObjectId(studentId)) {
      throw new ApiError(400, "Invalid student ID");
    }

    // Fetch active enrollments
    const enrollments = await Enrollment.find({
      student: studentId,
      status: "active",
      paymentStatus: { $in: ["free", "paid"] },
    })
      .populate({
        path: "course",
        select:
          "title shortDescription description thumbnail price category level isPublished",
      })
      .sort({ enrolledAt: -1 })
      .lean();

    // Keep only published courses
    const validEnrollments = enrollments.filter(
      (enrollment) =>
        enrollment.course &&
        typeof enrollment.course === "object" &&
        "isPublished" in enrollment.course &&
        enrollment.course.isPublished === true
    );

    const courseIds = validEnrollments.map((enrollment) => {
      const course = enrollment.course as unknown as {
        _id: mongoose.Types.ObjectId;
      };

      return course._id;
    });

    // Fetch progress and published lesson counts
    const [progressRecords, lessonCounts, publishedLessons] =
      await Promise.all([
        Progress.find({
          student: studentId,
          course: { $in: courseIds },
        }).lean(),

        Lesson.aggregate([
          {
            $match: {
              course: { $in: courseIds },
              isPublished: true,
            },
          },
          {
            $group: {
              _id: "$course",
              totalLessons: { $sum: 1 },
            },
          },
        ]),

        Lesson.find({
          course: { $in: courseIds },
          isPublished: true,
        })
          .select("_id course")
          .lean(),
      ]);

    const progressByCourse = new Map(
      progressRecords.map((progress) => [
        progress.course.toString(),
        progress,
      ])
    );

    const lessonCountByCourse = new Map(
      lessonCounts.map((item) => [
        item._id.toString(),
        item.totalLessons as number,
      ])
    );

    // Group published lesson IDs by course
    const publishedLessonIdsByCourse = new Map<string, Set<string>>();

    for (const lesson of publishedLessons) {
      const courseId = lesson.course.toString();

      if (!publishedLessonIdsByCourse.has(courseId)) {
        publishedLessonIdsByCourse.set(courseId, new Set<string>());
      }

      publishedLessonIdsByCourse
        .get(courseId)!
        .add(lesson._id.toString());
    }

    let completedCourses = 0;
    let totalProgressPercentage = 0;

    // Prepare course data
    const courses = validEnrollments.map((enrollment) => {
      const course = enrollment.course as unknown as {
        _id: mongoose.Types.ObjectId;
        title: string;
        shortDescription?: string;
        description: string;
        thumbnail?: string;
        price: number;
        category: string;
        level: string;
      };

      const courseId = course._id.toString();
      const progress = progressByCourse.get(courseId);

      const totalLessons = lessonCountByCourse.get(courseId) ?? 0;

      const publishedLessonIds =
        publishedLessonIdsByCourse.get(courseId) ?? new Set<string>();

      // Count only completed lessons that are currently published
      const completedLessons = (
        progress?.completedLessons ?? []
      ).filter((lessonId) =>
        publishedLessonIds.has(lessonId.toString())
      ).length;

      const percentage =
        totalLessons === 0
          ? 0
          : Math.round((completedLessons / totalLessons) * 100);

      // Count a course as completed only if it has published lessons
      // and all published lessons are completed.
      if (totalLessons > 0 && completedLessons === totalLessons) {
        completedCourses += 1;
      }

      totalProgressPercentage += percentage;

      return {
        courseId,
        title: course.title,
        shortDescription: course.shortDescription,
        description: course.description,
        thumbnail: course.thumbnail,
        price: course.price,
        category: course.category,
        level: course.level,
        enrolledAt: enrollment.enrolledAt ?? null,
        progress: {
          completedLessons,
          totalLessons,
          percentage,
          lastAccessedAt: progress?.lastAccessedAt ?? null,
        },
      };
    });

    const totalEnrolledCourses = courses.length;

    const overallProgress =
      totalEnrolledCourses === 0
        ? 0
        : Math.round(totalProgressPercentage / totalEnrolledCourses);

    // Get the five most recently accessed courses
    const recentLearning = [...courses]
      .filter((course) => course.progress.lastAccessedAt !== null)
      .sort(
        (a, b) =>
          new Date(b.progress.lastAccessedAt!).getTime() -
          new Date(a.progress.lastAccessedAt!).getTime()
      )
      .slice(0, 5);

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalEnrolledCourses,
          completedCourses,
          inProgressCourses: courses.filter(
            (course) =>
              course.progress.completedLessons > 0 &&
              course.progress.percentage < 100
          ).length,
          overallProgress,
        },
        courses,
        recentLearning,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get Student's Enrolled Courses
export const getMyCourses = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const studentId = req.userId;

    if (!studentId) {
      throw new ApiError(401, "Authentication required");
    }

    if (!mongoose.isValidObjectId(studentId)) {
      throw new ApiError(400, "Invalid student ID");
    }

    // Fetch active enrollments
    const enrollments = await Enrollment.find({
      student: studentId,
      status: "active",
      paymentStatus: { $in: ["free", "paid"] },
    })
      .populate({
        path: "course",
        select:
          "title shortDescription description thumbnail price category level isPublished",
      })
      .sort({ enrolledAt: -1 })
      .lean();

    // Keep only published courses
    const validEnrollments = enrollments.filter(
      (enrollment) =>
        enrollment.course &&
        typeof enrollment.course === "object" &&
        "isPublished" in enrollment.course &&
        enrollment.course.isPublished === true
    );

    const courseIds = validEnrollments.map((enrollment) => {
      const course = enrollment.course as unknown as {
        _id: mongoose.Types.ObjectId;
      };

      return course._id;
    });

    const [progressRecords, lessonCounts, publishedLessons] =
      await Promise.all([
        Progress.find({
          student: studentId,
          course: { $in: courseIds },
        }).lean(),

        Lesson.aggregate([
          {
            $match: {
              course: { $in: courseIds },
              isPublished: true,
            },
          },
          {
            $group: {
              _id: "$course",
              totalLessons: { $sum: 1 },
            },
          },
        ]),

        Lesson.find({
          course: { $in: courseIds },
          isPublished: true,
        })
          .select("_id course")
          .lean(),
      ]);

    const progressByCourse = new Map(
      progressRecords.map((progress) => [
        progress.course.toString(),
        progress,
      ])
    );

    const lessonCountByCourse = new Map(
      lessonCounts.map((item) => [
        item._id.toString(),
        item.totalLessons as number,
      ])
    );

    // Group published lesson IDs by course
    const publishedLessonIdsByCourse = new Map<string, Set<string>>();

    for (const lesson of publishedLessons) {
      const courseId = lesson.course.toString();

      if (!publishedLessonIdsByCourse.has(courseId)) {
        publishedLessonIdsByCourse.set(courseId, new Set<string>());
      }

      publishedLessonIdsByCourse
        .get(courseId)!
        .add(lesson._id.toString());
    }

    // Prepare enrolled courses with accurate progress
    const courses = validEnrollments.map((enrollment) => {
      const course = enrollment.course as unknown as {
        _id: mongoose.Types.ObjectId;
        title: string;
        shortDescription?: string;
        description: string;
        thumbnail?: string;
        price: number;
        category: string;
        level: string;
      };

      const courseId = course._id.toString();
      const progress = progressByCourse.get(courseId);

      const totalLessons = lessonCountByCourse.get(courseId) ?? 0;

      const publishedLessonIds =
        publishedLessonIdsByCourse.get(courseId) ?? new Set<string>();

      const completedLessons = (
        progress?.completedLessons ?? []
      ).filter((lessonId) =>
        publishedLessonIds.has(lessonId.toString())
      ).length;

      const percentage =
        totalLessons === 0
          ? 0
          : Math.round((completedLessons / totalLessons) * 100);

      return {
        courseId,
        title: course.title,
        shortDescription: course.shortDescription,
        description: course.description,
        thumbnail: course.thumbnail,
        price: course.price,
        category: course.category,
        level: course.level,
        enrolledAt: enrollment.enrolledAt ?? null,
        progress: {
          completedLessons,
          totalLessons,
          percentage,
          lastAccessedAt: progress?.lastAccessedAt ?? null,
        },
      };
    });

    res.status(200).json({
      success: true,
      results: courses.length,
      data: {
        courses,
      },
    });
  } catch (error) {
    next(error);
  }
};