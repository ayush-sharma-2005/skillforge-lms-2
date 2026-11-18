import type { Response } from "express";
import mongoose from "mongoose";

import { LearningSession } from "./learningSession.model";
import { Course } from "../courses/course.model";
import Lesson from "../lessons/lesson.model";
import Enrollment from "../enrollments/enrollment.model";
import Progress from "../progress/progress.model";

import {
  type HeartbeatInput,
  type TimeAnalyticsQueryInput,
} from "./learningTime.validation";

import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import type { AuthRequest } from "../../middlewares/auth.middleware";

// Helper: Format date as YYYY-MM-DD
const getTodayDateString = (d: Date = new Date()): string => {
  return d.toISOString().split("T")[0];
};

// RECORD ACTIVE LEARNING HEARTBEAT (Ping from client during active viewing)
export const recordHeartbeat = asyncHandler(async (req, res) => {
  const authReq = req as AuthRequest;
  const studentId = authReq.userId;

  if (!studentId) {
    throw new ApiError(401, "Authentication required");
  }

  const { courseId, lessonId, durationSeconds } = req.body as HeartbeatInput;

  // Max cap per heartbeat (120 seconds) prevents artificial idle inflation
  const safeSeconds = Math.min(120, Math.max(1, durationSeconds));

  // Verify active enrollment
  const isEnrolled = await Enrollment.exists({
    student: studentId,
    course: courseId,
    status: "active",
  });

  if (!isEnrolled) {
    throw new ApiError(
      403,
      "Active enrollment required to record learning time"
    );
  }

  // Verify lesson belongs to course
  const lesson = await Lesson.findOne({
    _id: lessonId,
    course: courseId,
    isPublished: true,
  });

  if (!lesson) {
    throw new ApiError(404, "Published lesson not found in this course");
  }

  const todayStr = getTodayDateString();

  const session = await LearningSession.findOneAndUpdate(
    {
      student: new mongoose.Types.ObjectId(studentId),
      course: new mongoose.Types.ObjectId(courseId),
      lesson: new mongoose.Types.ObjectId(lessonId),
      sessionDate: todayStr,
    },
    {
      $inc: { durationSeconds: safeSeconds },
      $set: { lastHeartbeatAt: new Date() },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  // Also update lastAccessedAt in student Progress
  await Progress.updateOne(
    {
      student: studentId,
      course: courseId,
    },
    {
      $set: { lastAccessedAt: new Date() },
    }
  );

  // Calculate current totals for response feedback
  const [lessonTotal, courseTotal] = await Promise.all([
    LearningSession.aggregate([
      {
        $match: {
          student: new mongoose.Types.ObjectId(studentId),
          lesson: new mongoose.Types.ObjectId(lessonId),
        },
      },
      {
        $group: {
          _id: null,
          totalSeconds: { $sum: "$durationSeconds" },
        },
      },
    ]),
    LearningSession.aggregate([
      {
        $match: {
          student: new mongoose.Types.ObjectId(studentId),
          course: new mongoose.Types.ObjectId(courseId),
        },
      },
      {
        $group: {
          _id: null,
          totalSeconds: { $sum: "$durationSeconds" },
        },
      },
    ]),
  ]);

  res.status(200).json({
    success: true,
    message: "Learning heartbeat recorded",
    data: {
      addedSeconds: safeSeconds,
      sessionDate: todayStr,
      todayLessonSeconds: session.durationSeconds,
      allTimeLessonSeconds: lessonTotal[0]?.totalSeconds || safeSeconds,
      allTimeCourseSeconds: courseTotal[0]?.totalSeconds || safeSeconds,
    },
  });
});

// GET LOGGED-IN STUDENT'S LEARNING TIME ANALYTICS (Daily, Weekly, Monthly, Course-wise)
export const getStudentTimeAnalytics = asyncHandler(async (req, res) => {
  const authReq = req as AuthRequest;
  const studentId = authReq.userId;

  if (!studentId) {
    throw new ApiError(401, "Authentication required");
  }

  const studentObjId = new mongoose.Types.ObjectId(studentId);
  const query = req.query as unknown as TimeAnalyticsQueryInput;
  const daysLimit = Math.min(365, Math.max(1, Number(query.days) || 30));

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysLimit);
  const startDateStr = getTodayDateString(startDate);

  // 1. Daily breakdown over requested window
  const dailyBreakdown = await LearningSession.aggregate([
    {
      $match: {
        student: studentObjId,
        sessionDate: { $gte: startDateStr },
      },
    },
    {
      $group: {
        _id: "$sessionDate",
        totalSeconds: { $sum: "$durationSeconds" },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  // 2. Course-wise breakdown
  const courseBreakdown = await LearningSession.aggregate([
    {
      $match: {
        student: studentObjId,
      },
    },
    {
      $group: {
        _id: "$course",
        totalSeconds: { $sum: "$durationSeconds" },
        uniqueDays: { $addToSet: "$sessionDate" },
      },
    },
    {
      $lookup: {
        from: "courses",
        localField: "_id",
        foreignField: "_id",
        as: "courseInfo",
      },
    },
    {
      $unwind: {
        path: "$courseInfo",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        courseId: "$_id",
        title: "$courseInfo.title",
        thumbnail: "$courseInfo.thumbnail",
        totalSeconds: 1,
        totalHours: {
          $round: [{ $divide: ["$totalSeconds", 3600] }, 2],
        },
        activeDaysCount: { $size: "$uniqueDays" },
      },
    },
    {
      $sort: { totalSeconds: -1 },
    },
  ]);

  // Overall calculations
  const totalAllTimeSeconds = courseBreakdown.reduce(
    (acc, curr) => acc + curr.totalSeconds,
    0
  );

  const past7DaysDate = new Date();
  past7DaysDate.setDate(past7DaysDate.getDate() - 7);
  const past7DaysStr = getTodayDateString(past7DaysDate);

  const past30DaysDate = new Date();
  past30DaysDate.setDate(past30DaysDate.getDate() - 30);
  const past30DaysStr = getTodayDateString(past30DaysDate);

  const past7DaysSeconds = dailyBreakdown
    .filter((d) => d._id >= past7DaysStr)
    .reduce((acc, curr) => acc + curr.totalSeconds, 0);

  const past30DaysSeconds = dailyBreakdown
    .filter((d) => d._id >= past30DaysStr)
    .reduce((acc, curr) => acc + curr.totalSeconds, 0);

  // Format daily breakdown with hours and minutes
  const formattedDaily = dailyBreakdown.map((item) => ({
    date: item._id,
    seconds: item.totalSeconds,
    minutes: Math.round(item.totalSeconds / 60),
    hours: Number((item.totalSeconds / 3600).toFixed(2)),
  }));

  // Add percentage share to course breakdown
  const formattedCourses = courseBreakdown.map((c) => ({
    ...c,
    percentageShare:
      totalAllTimeSeconds > 0
        ? Math.round((c.totalSeconds / totalAllTimeSeconds) * 100)
        : 0,
  }));

  res.status(200).json({
    success: true,
    data: {
      summary: {
        totalAllTimeSeconds,
        totalAllTimeHours: Number((totalAllTimeSeconds / 3600).toFixed(2)),
        past7DaysHours: Number((past7DaysSeconds / 3600).toFixed(2)),
        past30DaysHours: Number((past30DaysSeconds / 3600).toFixed(2)),
        dailyAverageMinutes:
          formattedDaily.length > 0
            ? Math.round(past30DaysSeconds / formattedDaily.length / 60)
            : 0,
      },
      dailyBreakdown: formattedDaily,
      courseBreakdown: formattedCourses,
    },
  });
});

// GET COURSE-WISE LEARNING TIME REPORT (Instructor / Admin Analytics)
export const getCourseTimeAnalytics = asyncHandler(async (req, res) => {
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

  // Aggregate total metrics and unique students
  const [overviewMetrics, lessonAnalytics, dailyTrend] = await Promise.all([
    LearningSession.aggregate([
      {
        $match: { course: courseObjId },
      },
      {
        $group: {
          _id: null,
          totalSeconds: { $sum: "$durationSeconds" },
          uniqueStudents: { $addToSet: "$student" },
          totalSessions: { $sum: 1 },
        },
      },
    ]),

    // Lesson-by-lesson breakdown
    LearningSession.aggregate([
      {
        $match: { course: courseObjId },
      },
      {
        $group: {
          _id: "$lesson",
          totalSeconds: { $sum: "$durationSeconds" },
          studentCount: { $addToSet: "$student" },
        },
      },
      {
        $lookup: {
          from: "lessons",
          localField: "_id",
          foreignField: "_id",
          as: "lessonInfo",
        },
      },
      {
        $unwind: {
          path: "$lessonInfo",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          lessonId: "$_id",
          title: "$lessonInfo.title",
          order: "$lessonInfo.order",
          durationSeconds: "$lessonInfo.duration",
          activeSeconds: "$totalSeconds",
          activeHours: {
            $round: [{ $divide: ["$totalSeconds", 3600] }, 2],
          },
          engagedStudents: { $size: "$studentCount" },
          averageSecondsPerStudent: {
            $cond: [
              { $gt: [{ $size: "$studentCount" }, 0] },
              { $round: [{ $divide: ["$totalSeconds", { $size: "$studentCount" }] }, 0] },
              0,
            ],
          },
        },
      },
      {
        $sort: { order: 1 },
      },
    ]),

    // Daily engagement trend (past 30 days)
    LearningSession.aggregate([
      {
        $match: { course: courseObjId },
      },
      {
        $group: {
          _id: "$sessionDate",
          totalSeconds: { $sum: "$durationSeconds" },
          activeStudents: { $addToSet: "$student" },
        },
      },
      {
        $sort: { _id: 1 },
      },
      {
        $project: {
          date: "$_id",
          totalHours: {
            $round: [{ $divide: ["$totalSeconds", 3600] }, 2],
          },
          studentCount: { $size: "$activeStudents" },
        },
      },
    ]),
  ]);

  const totalCourseSeconds = overviewMetrics[0]?.totalSeconds || 0;
  const uniqueStudentCount = overviewMetrics[0]?.uniqueStudents?.length || 0;
  const averageStudentHours =
    uniqueStudentCount > 0
      ? Number((totalCourseSeconds / uniqueStudentCount / 3600).toFixed(2))
      : 0;

  res.status(200).json({
    success: true,
    data: {
      course: {
        id: course._id,
        title: course.title,
      },
      summary: {
        totalActiveHours: Number((totalCourseSeconds / 3600).toFixed(2)),
        totalActiveSeconds: totalCourseSeconds,
        activeStudentCount: uniqueStudentCount,
        averageHoursPerStudent: averageStudentHours,
      },
      lessonBreakdown: lessonAnalytics,
      dailyTrend,
    },
  });
});
