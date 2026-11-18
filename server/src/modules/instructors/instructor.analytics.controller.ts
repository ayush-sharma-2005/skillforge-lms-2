import type { Response } from "express";
import mongoose from "mongoose";

import { Course } from "../courses/course.model";
import Enrollment from "../enrollments/enrollment.model";
import Lesson from "../lessons/lesson.model";
import Progress from "../progress/progress.model";
import { LearningSession } from "../learningTime/learningSession.model";
import { Assignment } from "../assignments/assignment.model";
import { Submission } from "../assignments/submission.model";
import { Discussion } from "../discussions/discussion.model";

import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import type { AuthRequest } from "../../middlewares/auth.middleware";

// LIVE OVERVIEW ANALYTICS — Instructor / Admin
export const getLiveOverviewAnalytics = asyncHandler(
  async (req, res: Response) => {
    const authReq = req as AuthRequest;
    const instructorId = authReq.userId;

    if (!instructorId) {
      throw new ApiError(401, "Authentication required");
    }

    const instructorObjectId = new mongoose.Types.ObjectId(instructorId);

    // 1. Fetch instructor course IDs
    const courses = await Course.find({ instructor: instructorObjectId })
      .select("_id title price isPublished createdAt")
      .lean();

    const courseIds = courses.map((c) => c._id);
    const totalCourses = courses.length;
    const publishedCourses = courses.filter((c) => c.isPublished).length;

    if (courseIds.length === 0) {
      res.status(200).json({
        success: true,
        data: {
          summary: {
            totalCourses: 0,
            publishedCourses: 0,
            totalStudents: 0,
            activeStudentsPast7Days: 0,
            totalLearningHours: 0,
            averageCompletionRate: 0,
          },
          enrollmentTrend: [],
          coursePerformance: [],
          recentActivity: [],
        },
      });
      return;
    }

    // 2. Total active enrollments & unique students
    const enrollmentStats = await Enrollment.aggregate([
      {
        $match: {
          course: { $in: courseIds },
          status: "active",
        },
      },
      {
        $group: {
          _id: null,
          totalEnrollments: { $sum: 1 },
          uniqueStudents: { $addToSet: "$student" },
        },
      },
    ]);

    const totalEnrollments = enrollmentStats[0]?.totalEnrollments || 0;
    const uniqueStudentCount = enrollmentStats[0]?.uniqueStudents?.length || 0;

    // 3. Total active learning time across instructor's courses
    const learningStats = await LearningSession.aggregate([
      {
        $match: {
          course: { $in: courseIds },
        },
      },
      {
        $group: {
          _id: null,
          totalSeconds: { $sum: "$totalActiveSeconds" },
          activeSessionCount: { $sum: 1 },
        },
      },
    ]);

    const totalLearningSeconds = learningStats[0]?.totalSeconds || 0;
    const totalLearningHours = Math.round((totalLearningSeconds / 3600) * 10) / 10;

    // 4. Students active in past 7 days (via Progress or LearningSession)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentActiveStudents = await LearningSession.distinct("student", {
      course: { $in: courseIds },
      lastHeartbeat: { $gte: sevenDaysAgo },
    });

    // 5. Course Completion Rates across cohort
    const allLessons = await Lesson.find({
      course: { $in: courseIds },
      isPublished: true,
    })
      .select("_id course")
      .lean();

    const courseLessonCountMap = new Map<string, number>();
    for (const l of allLessons) {
      const cId = l.course.toString();
      courseLessonCountMap.set(cId, (courseLessonCountMap.get(cId) || 0) + 1);
    }

    const progressRecords = await Progress.find({
      course: { $in: courseIds },
    })
      .select("student course completedLessons")
      .lean();

    let completedEnrollmentsCount = 0;
    for (const p of progressRecords) {
      const totalInCourse = courseLessonCountMap.get(p.course.toString()) || 0;
      if (totalInCourse > 0 && p.completedLessons.length >= totalInCourse) {
        completedEnrollmentsCount++;
      }
    }

    const averageCompletionRate =
      totalEnrollments > 0
        ? Math.round((completedEnrollmentsCount / totalEnrollments) * 100)
        : 0;

    // 6. Enrollment Timeline (Monthly trend)
    const enrollmentTimeline = await Enrollment.aggregate([
      {
        $match: {
          course: { $in: courseIds },
          status: "active",
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$enrolledAt" },
            month: { $month: "$enrolledAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
      { $limit: 12 },
    ]);

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalCourses,
          publishedCourses,
          totalEnrollments,
          uniqueStudents: uniqueStudentCount,
          activeStudentsPast7Days: recentActiveStudents.length,
          totalLearningHours,
          completedEnrollmentsCount,
          averageCompletionRate,
        },
        enrollmentTrend: enrollmentTimeline.map((item) => ({
          year: item._id.year,
          month: item._id.month,
          count: item.count,
        })),
        timestamp: new Date(),
      },
    });
  }
);

// COURSE-WISE LIVE DETAILED ANALYTICS — Instructor / Admin
export const getCourseLiveAnalytics = asyncHandler(
  async (req, res: Response) => {
    const authReq = req as AuthRequest;
    const instructorId = authReq.userId;
    const courseId =
      typeof req.params.courseId === "string" ? req.params.courseId : "";

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      throw new ApiError(400, "Invalid course ID");
    }

    const course = await Course.findById(courseId);
    if (!course) {
      throw new ApiError(404, "Course not found");
    }

    const isOwner = course.instructor.toString() === instructorId;
    const isAdmin = authReq.userRole === "admin";
    if (!isOwner && !isAdmin) {
      throw new ApiError(403, "You can only view analytics for your own courses");
    }

    const courseObjectId = new mongoose.Types.ObjectId(courseId);

    // 1. Lessons in course
    const lessons = await Lesson.find({
      course: courseObjectId,
      isPublished: true,
    })
      .select("_id title order")
      .sort({ order: 1 })
      .lean();

    const totalLessons = lessons.length;

    // 2. Active Enrollments
    const enrollments = await Enrollment.find({
      course: courseObjectId,
      status: "active",
    })
      .select("student enrolledAt")
      .lean();

    const totalEnrolled = enrollments.length;

    // 3. Progress distribution & funnel
    const progressList = await Progress.find({ course: courseObjectId })
      .select("student completedLessons lastAccessedAt")
      .lean();

    const progressDistribution = {
      notStarted: 0, // 0%
      inProgressLow: 0, // 1-25%
      inProgressMid: 0, // 26-75%
      nearCompletion: 0, // 76-99%
      completed: 0, // 100%
    };

    const lessonCompletionCount = new Map<string, number>();
    for (const l of lessons) {
      lessonCompletionCount.set(l._id.toString(), 0);
    }

    for (const prog of progressList) {
      const completedCount = prog.completedLessons.length;
      const pct =
        totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

      if (pct === 0) progressDistribution.notStarted++;
      else if (pct <= 25) progressDistribution.inProgressLow++;
      else if (pct <= 75) progressDistribution.inProgressMid++;
      else if (pct < 100) progressDistribution.nearCompletion++;
      else progressDistribution.completed++;

      for (const compId of prog.completedLessons) {
        const idStr = compId.toString();
        if (lessonCompletionCount.has(idStr)) {
          lessonCompletionCount.set(
            idStr,
            (lessonCompletionCount.get(idStr) || 0) + 1
          );
        }
      }
    }

    // Identify drop-off lesson
    const funnel = lessons.map((l) => ({
      lessonId: l._id,
      title: l.title,
      order: l.order,
      completions: lessonCompletionCount.get(l._id.toString()) || 0,
    }));

    let highestDrop = 0;
    let dropOffLesson = null;
    for (let i = 0; i < funnel.length - 1; i++) {
      const drop = funnel[i].completions - funnel[i + 1].completions;
      if (drop > highestDrop) {
        highestDrop = drop;
        dropOffLesson = {
          fromLesson: funnel[i].title,
          toLesson: funnel[i + 1].title,
          dropCount: drop,
        };
      }
    }

    // 4. Learning Time Analytics for this course
    const learningAgg = await LearningSession.aggregate([
      { $match: { course: courseObjectId } },
      {
        $group: {
          _id: null,
          totalSeconds: { $sum: "$totalActiveSeconds" },
          sessionCount: { $sum: 1 },
          avgSecondsPerSession: { $avg: "$totalActiveSeconds" },
        },
      },
    ]);

    const totalActiveSeconds = learningAgg[0]?.totalSeconds || 0;
    const avgMinutesPerStudent =
      totalEnrolled > 0
        ? Math.round(totalActiveSeconds / 60 / totalEnrolled)
        : 0;

    // 5. Assignment Performance
    const assignments = await Assignment.find({ course: courseObjectId })
      .select("_id title maxScore")
      .lean();

    const assignmentIds = assignments.map((a) => a._id);
    const submissions = await Submission.find({
      assignment: { $in: assignmentIds },
    })
      .select("assignment grade status similarityReport")
      .lean();

    const gradedSubmissions = submissions.filter(
      (s) => s.grade && typeof s.grade.score === "number"
    );
    const avgAssignmentScore =
      gradedSubmissions.length > 0
        ? Math.round(
            gradedSubmissions.reduce((sum, s) => sum + (s.grade?.score || 0), 0) /
              gradedSubmissions.length
          )
        : 0;

    const flaggedSubmissionsCount = submissions.filter(
      (s) => s.similarityReport?.flaggedForReview
    ).length;

    // 6. Discussion Activity
    const discussionStats = await Discussion.aggregate([
      { $match: { course: courseObjectId } },
      {
        $group: {
          _id: null,
          totalQuestions: { $sum: 1 },
          totalReplies: { $sum: { $size: "$replies" } },
        },
      },
    ]);

    const totalQuestions = discussionStats[0]?.totalQuestions || 0;
    const totalReplies = discussionStats[0]?.totalReplies || 0;

    res.status(200).json({
      success: true,
      data: {
        course: {
          id: course._id,
          title: course.title,
          totalLessons,
          totalEnrolled,
        },
        progressDistribution,
        completionRate:
          totalEnrolled > 0
            ? Math.round(
                (progressDistribution.completed / totalEnrolled) * 100
              )
            : 0,
        funnel,
        dropOffAnalysis: dropOffLesson,
        learningTime: {
          totalHours: Math.round((totalActiveSeconds / 3600) * 10) / 10,
          avgMinutesPerStudent,
          totalSessions: learningAgg[0]?.sessionCount || 0,
        },
        assignments: {
          totalAssignments: assignments.length,
          totalSubmissions: submissions.length,
          gradedSubmissions: gradedSubmissions.length,
          avgScore: avgAssignmentScore,
          flaggedForPlagiarismReview: flaggedSubmissionsCount,
        },
        discussions: {
          totalQuestions,
          totalReplies,
        },
        timestamp: new Date(),
      },
    });
  }
);

