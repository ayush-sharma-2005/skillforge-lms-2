import { Response, NextFunction } from "express";
import mongoose from "mongoose";

import Enrollment from "./enrollment.model";
import { Course } from "../courses/course.model";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { isCourseCompletedByStudent } from "../learningPaths/learningPath.controller";

// Enroll in a course
export const enrollInCourse = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const studentId = req.userId;
    const { courseId } = req.params;

    if (!studentId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    if (!mongoose.isValidObjectId(courseId)) {
      res.status(400).json({
        success: false,
        message: "Invalid course ID",
      });
      return;
    }

    const course = await Course.findOne({
      _id: courseId,
      isPublished: true,
    });

    if (!course) {
      res.status(404).json({
        success: false,
        message: "Published course not found",
      });
      return;
    }

    if (course.instructor.toString() === studentId.toString()) {
      res.status(403).json({
        success: false,
        message: "You cannot enroll in your own course",
      });
      return;
    }

    // Check course prerequisites if configured
    if (course.prerequisites && course.prerequisites.length > 0) {
      const unmetPrerequisites: string[] = [];

      for (const prereqId of course.prerequisites) {
        const isDone = await isCourseCompletedByStudent(studentId, prereqId);
        if (!isDone) {
          const prereqCourse = await Course.findById(prereqId).select("title");
          unmetPrerequisites.push(prereqCourse?.title || prereqId.toString());
        }
      }

      if (unmetPrerequisites.length > 0) {
        res.status(403).json({
          success: false,
          message: `Cannot enroll. You must complete the following prerequisite courses first: ${unmetPrerequisites.join(", ")}`,
          unmetPrerequisites,
        });
        return;
      }
    }

    const existingEnrollment = await Enrollment.findOne({
      student: studentId,
      course: courseId,
    });

    if (existingEnrollment) {
      res.status(409).json({
        success: false,
        message: "You already have an enrollment record for this course",
      });
      return;
    }

    const isFreeCourse = course.price === 0;

    const enrollment = new Enrollment({
      student: studentId,
      course: courseId,
      status: isFreeCourse ? "active" : "pending",
      paymentStatus: isFreeCourse ? "free" : "pending",
      amount: course.price,
      ...(isFreeCourse ? { enrolledAt: new Date() } : {}),
    });

    await enrollment.save();

    res.status(isFreeCourse ? 201 : 202).json({
      success: true,
      message: isFreeCourse
        ? "Successfully enrolled in free course"
        : "Enrollment created. Payment is required before course access",
      data: {
        enrollment,
      },
    });
  } catch (error) {
    if (
      error instanceof mongoose.mongo.MongoServerError &&
      error.code === 11000
    ) {
      res.status(409).json({
        success: false,
        message: "You already have an enrollment record for this course",
      });
      return;
    }

    next(error);
  }
};

// Get the logged-in student's active enrollments
export const getMyEnrollments = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const studentId = req.userId;

    if (!studentId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const enrollments = await Enrollment.find({
      student: studentId,
      status: "active",
    })
      .populate({
        path: "course",
        select:
          "title shortDescription thumbnail price category level instructor",
        populate: {
          path: "instructor",
          select: "name",
        },
      })
      .sort({ enrolledAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        enrollments,
      },
    });
  } catch (error) {
    next(error);
  }
};
