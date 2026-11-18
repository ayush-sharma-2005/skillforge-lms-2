import type { Response, NextFunction } from "express";
import mongoose from "mongoose";

import { Course } from "../courses/course.model";
import Enrollment from "../enrollments/enrollment.model";
import type { AuthRequest } from "../../middlewares/auth.middleware";

import { User } from "../auth/auth.model";
import Lesson from "../lessons/lesson.model";
import Progress from "../progress/progress.model";

export const getInstructorDashboard = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const instructorId = req.userId;

    if (!instructorId || !mongoose.isValidObjectId(instructorId)) {
      res.status(401).json({
        success: false,
        message: "Invalid instructor authentication",
      });
      return;
    }

    const instructorObjectId = new mongoose.Types.ObjectId(instructorId);

    // Fetch instructor's courses
    const courses = await Course.find({
      instructor: instructorObjectId,
    })
      .select("title price category level isPublished createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const courseIds = courses.map((course) => course._id);

    // Count enrollments for each course
    const enrollmentStats = await Enrollment.aggregate([
      {
        $match: {
          course: { $in: courseIds },
          status: "active",
          paymentStatus: { $in: ["free", "paid"] },
        },
      },
      {
        $group: {
          _id: "$course",
          totalStudents: { $sum: 1 },
        },
      },
    ]);

    const enrollmentMap = new Map<string, number>();

    for (const stat of enrollmentStats) {
      enrollmentMap.set(
        String(stat._id),
        stat.totalStudents
      );
    }

    const courseData = courses.map((course) => ({
      courseId: String(course._id),
      title: course.title,
      price: course.price,
      category: course.category,
      level: course.level,
      isPublished: course.isPublished,
      totalStudents: enrollmentMap.get(String(course._id)) ?? 0,
      createdAt: course.createdAt,
    }));

    const totalCourses = courses.length;

    const publishedCourses = courses.filter(
      (course) => course.isPublished
    ).length;

    const unpublishedCourses = totalCourses - publishedCourses;

    const totalEnrolledStudents = courseData.reduce(
      (total, course) => total + course.totalStudents,
      0
    );

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalCourses,
          publishedCourses,
          unpublishedCourses,
          totalEnrolledStudents,
        },
        courses: courseData,
      },
    });
  } catch (error) {
    next(error);
  }
};export const getCourseStudents = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const instructorId = req.userId;
    const { courseId } = req.params;

    if (!mongoose.isValidObjectId(courseId)) {
      res.status(400).json({
        success: false,
        message: "Invalid course ID",
      });
      return;
    }

    // Verify that the course belongs to this instructor
    const course = await Course.findOne({
      _id: courseId,
      instructor: instructorId,
    }).select("_id title");

    if (!course) {
      res.status(404).json({
        success: false,
        message: "Course not found or you are not the instructor",
      });
      return;
    }

    // Find active enrollments
    const enrollments = await Enrollment.find({
      course: course._id,
      status: "active",
      paymentStatus: { $in: ["free", "paid"] },
    })
      .select("student enrolledAt status paymentStatus")
      .sort({ enrolledAt: -1 })
      .lean();

    const studentIds = enrollments.map(
      (enrollment) => enrollment.student
    );

    const students = await User.find({
      _id: { $in: studentIds },
    })
      .select("_id name email")
      .lean();

    const studentMap = new Map(
      students.map((student) => [
        String(student._id),
        student,
      ])
    );

    const publishedLessons = await Lesson.find({
      course: course._id,
      isPublished: true,
    })
      .select("_id")
      .lean();

    const lessonIds = publishedLessons.map(
      (lesson) => lesson._id
    );

    const progressRecords = await Progress.find({
      course: course._id,
      student: { $in: studentIds },
    }).lean();

    const progressMap = new Map(
      progressRecords.map((progress) => [
        String(progress.student),
        progress,
      ])
    );

    const studentData = enrollments.map((enrollment) => {
      const studentId = String(enrollment.student);
      const student = studentMap.get(studentId);
      const progress = progressMap.get(studentId);

      const completedLessonIds = progress
        ? progress.completedLessons.map(String)
        : [];

      const completedLessons = lessonIds.filter((lessonId) =>
        completedLessonIds.includes(String(lessonId))
      ).length;

      const totalLessons = lessonIds.length;

      const percentage =
        totalLessons > 0
          ? Math.round((completedLessons / totalLessons) * 100)
          : 0;

      return {
        studentId,
        name: student?.name ?? null,
        email: student?.email ?? null,
        enrolledAt: enrollment.enrolledAt ?? null,
        enrollmentStatus: enrollment.status,
        paymentStatus: enrollment.paymentStatus,
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
      data: {
        course: {
          courseId: String(course._id),
          title: course.title,
        },
        summary: {
          totalStudents: studentData.length,
          totalLessons: lessonIds.length,
        },
        students: studentData,
      },
    });
  } catch (error) {
    next(error);
  }
};

