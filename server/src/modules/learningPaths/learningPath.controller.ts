import type { Response } from "express";
import mongoose from "mongoose";

import { LearningPath, type ILearningPathCourse } from "./learningPath.model";
import { Course } from "../courses/course.model";
import Lesson from "../lessons/lesson.model";
import Progress from "../progress/progress.model";
import Enrollment from "../enrollments/enrollment.model";

import {
  type CreateLearningPathInput,
  type UpdateLearningPathInput,
  type LearningPathQueryInput,
} from "./learningPath.validation";

import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import type { AuthRequest } from "../../middlewares/auth.middleware";

// Helper: check if a specific student has completed all published lessons in a course
export const isCourseCompletedByStudent = async (
  studentId: string | mongoose.Types.ObjectId,
  courseId: string | mongoose.Types.ObjectId
): Promise<boolean> => {
  const publishedLessons = await Lesson.find({
    course: courseId,
    isPublished: true,
  }).select("_id");

  if (publishedLessons.length === 0) {
    return false;
  }

  const progress = await Progress.findOne({
    student: studentId,
    course: courseId,
  }).select("completedLessons");

  if (!progress || !Array.isArray(progress.completedLessons)) {
    return false;
  }

  const completedSet = new Set(
    progress.completedLessons.map((id) => id.toString())
  );

  return publishedLessons.every((lesson) =>
    completedSet.has(lesson._id.toString())
  );
};

// CREATE LEARNING PATH — Instructor / Admin
export const createLearningPath = asyncHandler(async (req, res) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;

  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

  const body = req.body as CreateLearningPathInput;

  // Validate courses in sequence
  if (body.courses && body.courses.length > 0) {
    const courseIds = body.courses.map((c) => c.course);
    if (new Set(courseIds).size !== courseIds.length) {
      throw new ApiError(400, "Duplicate courses are not allowed in a learning path");
    }

    // Verify all courses exist
    const existingCourses = await Course.find({
      _id: { $in: courseIds },
    }).select("_id title");

    if (existingCourses.length !== courseIds.length) {
      throw new ApiError(400, "One or more course IDs in the learning path do not exist");
    }

    // Sort by order and validate prerequisites only refer to preceding courses
    const sortedCourses = [...body.courses].sort((a, b) => a.order - b.order);
    const seenCourses = new Set<string>();

    for (const item of sortedCourses) {
      for (const prereq of item.prerequisites || []) {
        if (prereq === item.course) {
          throw new ApiError(400, "A course cannot have itself as a prerequisite");
        }
        if (!seenCourses.has(prereq)) {
          throw new ApiError(
            400,
            "Prerequisite courses must appear before the dependent course in the learning path order"
          );
        }
      }
      seenCourses.add(item.course);
    }
  }

  const learningPath = await LearningPath.create({
    ...body,
    instructor: userId,
  });

  res.status(201).json({
    success: true,
    message: "Learning path created successfully",
    data: { learningPath },
  });
});

// GET ALL PUBLISHED LEARNING PATHS (Search, Filter, Pagination)
export const getLearningPaths = asyncHandler(async (req, res) => {
  const query = req.query as unknown as LearningPathQueryInput;

  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));

  const filter: Record<string, unknown> = {
    isPublished: true,
  };

  if (query.category) {
    filter.category = query.category;
  }

  if (query.level) {
    filter.level = query.level;
  }

  if (query.search) {
    filter.$text = { $search: query.search };
  }

  let sort: Record<string, 1 | -1> = { createdAt: -1 };
  if (query.sort === "oldest") {
    sort = { createdAt: 1 };
  } else if (query.sort === "title") {
    sort = { title: 1 };
  }

  const [paths, total] = await Promise.all([
    LearningPath.find(filter)
      .populate("instructor", "name email")
      .populate("courses.course", "title thumbnail price category level")
      .populate("courses.prerequisites", "title level")
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    LearningPath.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: {
      learningPaths: paths,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
});

// GET SINGLE LEARNING PATH DETAILS
export const getLearningPathById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, "Invalid learning path ID");
  }

  const learningPath = await LearningPath.findById(id)
    .populate("instructor", "name email")
    .populate("courses.course", "title description thumbnail price category level isPublished")
    .populate("courses.prerequisites", "title level thumbnail");

  if (!learningPath) {
    throw new ApiError(404, "Learning path not found");
  }

  res.status(200).json({
    success: true,
    data: { learningPath },
  });
});

// UPDATE LEARNING PATH — Instructor / Admin
export const updateLearningPath = asyncHandler(async (req, res) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;
  const { id } = req.params;

  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, "Invalid learning path ID");
  }

  const learningPath = await LearningPath.findById(id);
  if (!learningPath) {
    throw new ApiError(404, "Learning path not found");
  }

  const isOwner = learningPath.instructor.toString() === userId;
  const isAdmin = authReq.userRole === "admin";

  if (!isOwner && !isAdmin) {
    throw new ApiError(403, "You are not authorized to update this learning path");
  }

  const updates = req.body as UpdateLearningPathInput;

  if (updates.courses) {
    const courseIds = updates.courses.map((c) => c.course);
    if (new Set(courseIds).size !== courseIds.length) {
      throw new ApiError(400, "Duplicate courses are not allowed in a learning path");
    }

    const sortedCourses = [...updates.courses].sort((a, b) => a.order - b.order);
    const seenCourses = new Set<string>();

    for (const item of sortedCourses) {
      for (const prereq of item.prerequisites || []) {
        if (prereq === item.course) {
          throw new ApiError(400, "A course cannot have itself as a prerequisite");
        }
        if (!seenCourses.has(prereq)) {
          throw new ApiError(
            400,
            "Prerequisite courses must appear before the dependent course in the learning path order"
          );
        }
      }
      seenCourses.add(item.course);
    }
  }

  learningPath.set(updates);
  await learningPath.save();

  res.status(200).json({
    success: true,
    message: "Learning path updated successfully",
    data: { learningPath },
  });
});

// DELETE LEARNING PATH — Instructor / Admin
export const deleteLearningPath = asyncHandler(async (req, res) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;
  const { id } = req.params;

  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, "Invalid learning path ID");
  }

  const learningPath = await LearningPath.findById(id);
  if (!learningPath) {
    throw new ApiError(404, "Learning path not found");
  }

  const isOwner = learningPath.instructor.toString() === userId;
  const isAdmin = authReq.userRole === "admin";

  if (!isOwner && !isAdmin) {
    throw new ApiError(403, "You are not authorized to delete this learning path");
  }

  await learningPath.deleteOne();

  res.status(200).json({
    success: true,
    message: "Learning path deleted successfully",
  });
});

// TOGGLE PUBLISH LEARNING PATH — Instructor / Admin
export const toggleLearningPathPublish = asyncHandler(async (req, res) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;
  const { id } = req.params;

  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, "Invalid learning path ID");
  }

  const learningPath = await LearningPath.findById(id);
  if (!learningPath) {
    throw new ApiError(404, "Learning path not found");
  }

  const isOwner = learningPath.instructor.toString() === userId;
  const isAdmin = authReq.userRole === "admin";

  if (!isOwner && !isAdmin) {
    throw new ApiError(403, "You cannot modify publish state of this learning path");
  }

  learningPath.isPublished = !learningPath.isPublished;
  await learningPath.save();

  res.status(200).json({
    success: true,
    message: learningPath.isPublished
      ? "Learning path published successfully"
      : "Learning path unpublished successfully",
    data: { learningPath },
  });
});

// GET INSTRUCTOR CREATED LEARNING PATHS
export const getMyCreatedLearningPaths = asyncHandler(async (req, res) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;

  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

  const learningPaths = await LearningPath.find({
    instructor: userId,
  })
    .populate("courses.course", "title price level isPublished")
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: { learningPaths },
  });
});

// ENROLL IN LEARNING PATH — Student
export const enrollInLearningPath = asyncHandler(async (req, res) => {
  const authReq = req as AuthRequest;
  const studentId = authReq.userId;
  const { id } = req.params;

  if (!studentId) {
    throw new ApiError(401, "Authentication required");
  }

  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, "Invalid learning path ID");
  }

  const learningPath = await LearningPath.findOne({
    _id: id,
    isPublished: true,
  });

  if (!learningPath) {
    throw new ApiError(404, "Published learning path not found");
  }

  const studentObjId = new mongoose.Types.ObjectId(studentId);
  const isAlreadyEnrolled = learningPath.enrolledStudents.some((s) =>
    s.toString() === studentId
  );

  if (!isAlreadyEnrolled) {
    learningPath.enrolledStudents.push(studentObjId);
    await learningPath.save();
  }

  // Automatically enroll student into initial unlocked free courses in this path
  const coursesSorted = [...learningPath.courses].sort((a, b) => a.order - b.order);
  const enrolledCourseIds: string[] = [];

  for (const item of coursesSorted) {
    // If has no prerequisites, it's initial
    if (!item.prerequisites || item.prerequisites.length === 0) {
      const courseDoc = await Course.findById(item.course);
      if (courseDoc && courseDoc.price === 0) {
        const existingEnrollment = await Enrollment.findOne({
          student: studentId,
          course: item.course,
        });

        if (!existingEnrollment) {
          await Enrollment.create({
            student: studentId,
            course: item.course,
            status: "active",
            paymentStatus: "free",
            amount: 0,
            enrolledAt: new Date(),
          });
          enrolledCourseIds.push(item.course.toString());
        }
      }
    }
  }

  res.status(200).json({
    success: true,
    message: isAlreadyEnrolled
      ? "Already enrolled in this learning path"
      : "Successfully enrolled in learning path",
    data: {
      learningPathId: learningPath._id,
      autoEnrolledCourses: enrolledCourseIds,
    },
  });
});

// GET LEARNING PATH PROGRESS & PREREQUISITE STATUS — Student
// Automatically unlocks courses whose prerequisites are completed!
export const getLearningPathProgress = asyncHandler(async (req, res) => {
  const authReq = req as AuthRequest;
  const studentId = authReq.userId;
  const { id } = req.params;

  if (!studentId) {
    throw new ApiError(401, "Authentication required");
  }

  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, "Invalid learning path ID");
  }

  const learningPath = await LearningPath.findById(id)
    .populate("courses.course", "title thumbnail price category level isPublished")
    .populate("courses.prerequisites", "title level");

  if (!learningPath) {
    throw new ApiError(404, "Learning path not found");
  }

  const coursesSorted = [...learningPath.courses].sort((a, b) => a.order - b.order);
  const pathCourseIds = coursesSorted.map((c) => c.course._id);

  // Fetch student's enrollments and progress for courses in this path
  const [enrollments, progressRecords, allLessons] = await Promise.all([
    Enrollment.find({
      student: studentId,
      course: { $in: pathCourseIds },
      status: "active",
    }).lean(),
    Progress.find({
      student: studentId,
      course: { $in: pathCourseIds },
    }).lean(),
    Lesson.find({
      course: { $in: pathCourseIds },
      isPublished: true,
    }).select("_id course").lean(),
  ]);

  const enrollmentMap = new Set(enrollments.map((e) => e.course.toString()));
  const progressMap = new Map(
    progressRecords.map((p) => [p.course.toString(), p])
  );

  // Group published lessons by course
  const lessonsByCourse = new Map<string, string[]>();
  for (const lesson of allLessons) {
    const cId = lesson.course.toString();
    if (!lessonsByCourse.has(cId)) {
      lessonsByCourse.set(cId, []);
    }
    lessonsByCourse.get(cId)!.push(lesson._id.toString());
  }

  // Pre-calculate completed status for all courses
  const completedCoursesMap = new Map<string, boolean>();
  for (const item of coursesSorted) {
    const cId = item.course._id.toString();
    const publishedIds = lessonsByCourse.get(cId) || [];
    const progress = progressMap.get(cId);

    if (publishedIds.length > 0 && progress) {
      const completedIds = new Set(progress.completedLessons.map((l) => l.toString()));
      const isComplete = publishedIds.every((id) => completedIds.has(id));
      completedCoursesMap.set(cId, isComplete);
    } else {
      completedCoursesMap.set(cId, false);
    }
  }

  // Build course status list with prerequisite evaluation
  let completedCountInPath = 0;
  const courseStatusList = coursesSorted.map((item) => {
    const courseObj = item.course as unknown as {
      _id: mongoose.Types.ObjectId;
      title: string;
      thumbnail?: string;
      price: number;
      category: string;
      level: string;
    };
    const cId = courseObj._id.toString();

    // Check prerequisites
    const unmetPrerequisites: Array<{ courseId: string; title: string }> = [];
    for (const prereq of item.prerequisites || []) {
      const pDoc = prereq as unknown as { _id: mongoose.Types.ObjectId; title: string };
      const pId = pDoc._id.toString();
      const isPrereqDone = completedCoursesMap.get(pId) === true;
      if (!isPrereqDone) {
        unmetPrerequisites.push({
          courseId: pId,
          title: pDoc.title || "Prerequisite Course",
        });
      }
    }

    const isUnlocked = unmetPrerequisites.length === 0;
    const isEnrolled = enrollmentMap.has(cId);
    const progress = progressMap.get(cId);
    const publishedIds = lessonsByCourse.get(cId) || [];

    const completedLessonCount = progress
      ? progress.completedLessons.filter((l) => publishedIds.includes(l.toString())).length
      : 0;

    const totalLessonCount = publishedIds.length;
    const percentage =
      totalLessonCount > 0
        ? Math.round((completedLessonCount / totalLessonCount) * 100)
        : 0;

    const isCompleted = completedCoursesMap.get(cId) === true;
    if (isCompleted) {
      completedCountInPath++;
    }

    let status: "locked" | "available" | "in_progress" | "completed";
    if (!isUnlocked) {
      status = "locked";
    } else if (isCompleted) {
      status = "completed";
    } else if (percentage > 0) {
      status = "in_progress";
    } else {
      status = "available";
    }

    return {
      courseId: cId,
      title: courseObj.title,
      thumbnail: courseObj.thumbnail,
      price: courseObj.price,
      level: courseObj.level,
      order: item.order,
      isUnlocked,
      isEnrolled,
      status,
      unmetPrerequisites,
      progress: {
        completedLessons: completedLessonCount,
        totalLessons: totalLessonCount,
        percentage,
      },
    };
  });

  const totalCourses = courseStatusList.length;
  const overallPathPercentage =
    totalCourses > 0
      ? Math.round((completedCountInPath / totalCourses) * 100)
      : 0;

  res.status(200).json({
    success: true,
    data: {
      learningPath: {
        id: learningPath._id,
        title: learningPath.title,
        description: learningPath.description,
        thumbnail: learningPath.thumbnail,
        category: learningPath.category,
        level: learningPath.level,
      },
      summary: {
        totalCourses,
        completedCourses: completedCountInPath,
        unlockedCourses: courseStatusList.filter((c) => c.isUnlocked).length,
        lockedCourses: courseStatusList.filter((c) => !c.isUnlocked).length,
        overallPathPercentage,
      },
      courses: courseStatusList,
    },
  });
});

// GET STUDENT ENROLLED LEARNING PATHS (For Student Dashboard)
export const getMyLearningPaths = asyncHandler(async (req, res) => {
  const authReq = req as AuthRequest;
  const studentId = authReq.userId;

  if (!studentId) {
    throw new ApiError(401, "Authentication required");
  }

  const learningPaths = await LearningPath.find({
    enrolledStudents: studentId,
    isPublished: true,
  })
    .populate("instructor", "name")
    .populate("courses.course", "title thumbnail")
    .sort({ updatedAt: -1 });

  res.status(200).json({
    success: true,
    data: { learningPaths },
  });
});

// VALIDATE PREREQUISITES FOR COURSE ACCESS IN A LEARNING PATH
export const checkLearningPathCourseAccess = asyncHandler(async (req, res) => {
  const authReq = req as AuthRequest;
  const studentId = authReq.userId;
  const { id: pathId, courseId } = req.params;

  if (!studentId) {
    throw new ApiError(401, "Authentication required");
  }

  if (!mongoose.isValidObjectId(pathId) || !mongoose.isValidObjectId(courseId)) {
    throw new ApiError(400, "Invalid learning path or course ID");
  }

  const learningPath = await LearningPath.findById(pathId).populate(
    "courses.prerequisites",
    "title"
  );

  if (!learningPath) {
    throw new ApiError(404, "Learning path not found");
  }

  const pathItem = learningPath.courses.find(
    (c) => c.course.toString() === courseId
  );

  if (!pathItem) {
    throw new ApiError(404, "Course is not part of this learning path");
  }

  const unmetPrerequisites: string[] = [];

  for (const prereq of pathItem.prerequisites || []) {
    const pDoc = prereq as unknown as { _id: mongoose.Types.ObjectId; title: string };
    const isCompleted = await isCourseCompletedByStudent(studentId, pDoc._id);
    if (!isCompleted) {
      unmetPrerequisites.push(pDoc.title || pDoc._id.toString());
    }
  }

  const isUnlocked = unmetPrerequisites.length === 0;

  res.status(200).json({
    success: true,
    data: {
      learningPathId: pathId,
      courseId,
      isUnlocked,
      canAccess: isUnlocked,
      unmetPrerequisites,
      message: isUnlocked
        ? "Prerequisites satisfied. Course is unlocked."
        : `Course is locked. Complete the following prerequisites first: ${unmetPrerequisites.join(", ")}`,
    },
  });
});

