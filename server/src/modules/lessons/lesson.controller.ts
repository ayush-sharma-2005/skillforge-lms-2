import type { Response, NextFunction } from "express";
import mongoose from "mongoose";

import Lesson, { type ILesson } from "./lesson.model";
import { Course } from "../courses/course.model";
import Enrollment from "../enrollments/enrollment.model";
import type { AuthRequest } from "../../middlewares/auth.middleware";
import { getPreferredLanguage, localizeLesson } from "../../utils/language";
import type { LessonTranslationInput } from "./lesson.validation";

// Helper: check if a lesson is locked for a student based on drip rules
export const checkLessonDripLock = async (
  lesson: ILesson,
  studentId: string
): Promise<{ isLocked: boolean; availableAt: Date | null }> => {
  if (lesson.dripType === "none") {
    return { isLocked: false, availableAt: null };
  }

  const now = new Date();

  if (lesson.dripType === "date") {
    if (!lesson.unlockDate) {
      return { isLocked: false, availableAt: null };
    }
    const unlockTime = new Date(lesson.unlockDate);
    return { isLocked: now < unlockTime, availableAt: unlockTime };
  }

  if (lesson.dripType === "enrollment_days") {
    if (typeof lesson.unlockAfterDays !== "number" || lesson.unlockAfterDays <= 0) {
      return { isLocked: false, availableAt: null };
    }

    const enrollment = await Enrollment.findOne({
      student: studentId,
      course: lesson.course,
      status: "active",
    });

    const enrolledAt =
      enrollment?.enrolledAt ||
      (enrollment as unknown as { createdAt?: Date })?.createdAt ||
      now;

    const availableAt = new Date(
      new Date(enrolledAt).getTime() +
        lesson.unlockAfterDays * 24 * 60 * 60 * 1000
    );

    return { isLocked: now < availableAt, availableAt };
  }

  return { isLocked: false, availableAt: null };
};

// Create a lesson
export const createLesson = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const instructorId = req.userId;
    const courseId = req.params.courseId;
    const {
      title,
      description,
      videoUrl,
      duration,
      order,
      dripType = "none",
      unlockDate,
      unlockAfterDays,
      transcript,
      audioDescriptionUrl,
      captions = [],
      accessibility,
      translations = [],
    } = req.body;

    if (!instructorId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    if (!courseId || !mongoose.isValidObjectId(courseId)) {
      res.status(400).json({
        success: false,
        message: "Invalid course ID",
      });
      return;
    }

    const courseObjectId = new mongoose.Types.ObjectId(courseId.toString());
    const course = await Course.findById(courseObjectId);

    if (!course) {
      res.status(404).json({
        success: false,
        message: "Course not found",
      });
      return;
    }

    if (
      course.instructor.toString() !== instructorId &&
      req.userRole !== "admin"
    ) {
      res.status(403).json({
        success: false,
        message: "You can only add lessons to your own courses",
      });
      return;
    }

    const lesson = new Lesson({
      course: courseObjectId,
      title,
      description,
      videoUrl,
      duration,
      order,
      dripType,
      unlockDate: unlockDate ? new Date(unlockDate) : undefined,
      unlockAfterDays,
      transcript,
      audioDescriptionUrl,
      captions,
      accessibility,
      translations,
    });

    await lesson.save();

    res.status(201).json({
      success: true,
      message: "Lesson created successfully",
      data: { lesson },
    });
  } catch (error) {
    if (
      error instanceof mongoose.mongo.MongoServerError &&
      error.code === 11000
    ) {
      res.status(409).json({
        success: false,
        message: "A lesson with this order already exists in this course",
      });
      return;
    }

    next(error);
  }
};

// Get published lessons for a course (with drip locking and multi-language localization)
export const getCourseLessons = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const courseId = req.params.courseId;
    const userId = req.userId;

    if (!courseId || !mongoose.isValidObjectId(courseId)) {
      res.status(400).json({
        success: false,
        message: "Invalid course ID",
      });
      return;
    }

    const course = await Course.findById(courseId);

    if (!course || !course.isPublished) {
      res.status(404).json({
        success: false,
        message: "Published course not found",
      });
      return;
    }

    const isInstructorOrAdmin =
      Boolean(userId) &&
      (course.instructor.toString() === userId || req.userRole === "admin");

    let enrollmentDoc: InstanceType<typeof Enrollment> | null = null;

    if (!isInstructorOrAdmin) {
      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      enrollmentDoc = await Enrollment.findOne({
        student: userId,
        course: course._id,
        status: "active",
        paymentStatus: { $in: ["free", "paid"] },
      });

      if (!enrollmentDoc) {
        res.status(403).json({
          success: false,
          message: "Active enrollment required to access course lessons",
        });
        return;
      }
    }

    const lessons = await Lesson.find({
      course: course._id,
      isPublished: true,
    }).sort({ order: 1 });

    const now = new Date();
    const enrolledAt =
      enrollmentDoc?.enrolledAt ||
      (enrollmentDoc as unknown as { createdAt?: Date })?.createdAt ||
      now;

    const mappedLessons = lessons.map((lesson) => {
      let isLocked = false;
      let availableAt: Date | null = null;

      if (!isInstructorOrAdmin) {
        if (lesson.dripType === "date" && lesson.unlockDate) {
          availableAt = new Date(lesson.unlockDate);
          isLocked = now < availableAt;
        } else if (
          lesson.dripType === "enrollment_days" &&
          typeof lesson.unlockAfterDays === "number" &&
          lesson.unlockAfterDays > 0
        ) {
          availableAt = new Date(
            new Date(enrolledAt).getTime() +
              lesson.unlockAfterDays * 24 * 60 * 60 * 1000
          );
          isLocked = now < availableAt;
        }
      }

      if (isLocked) {
        return {
          _id: lesson._id,
          course: lesson.course,
          title: lesson.title,
          description: `This lesson is scheduled to become available on ${availableAt?.toISOString()}`,
          videoUrl: null,
          duration: lesson.duration,
          order: lesson.order,
          isPublished: lesson.isPublished,
          dripType: lesson.dripType,
          captions: [],
          transcript: null,
          audioDescriptionUrl: null,
          accessibility: lesson.accessibility,
          translations: lesson.translations,
          isLocked: true,
          availableAt,
        };
      }

      return {
        _id: lesson._id,
        course: lesson.course,
        title: lesson.title,
        description: lesson.description,
        videoUrl: lesson.videoUrl,
        duration: lesson.duration,
        order: lesson.order,
        isPublished: lesson.isPublished,
        dripType: lesson.dripType,
        unlockDate: lesson.unlockDate,
        unlockAfterDays: lesson.unlockAfterDays,
        transcript: lesson.transcript,
        audioDescriptionUrl: lesson.audioDescriptionUrl,
        captions: lesson.captions,
        accessibility: lesson.accessibility,
        translations: lesson.translations,
        isLocked: false,
        availableAt:
          lesson.dripType === "date"
            ? lesson.unlockDate
            : lesson.dripType === "enrollment_days"
            ? availableAt
            : null,
      };
    });

    const preferredLang = getPreferredLanguage(req);
    const localizedLessons = mappedLessons.map((l) =>
      localizeLesson(l, preferredLang)
    );

    res.status(200).json({
      success: true,
      data: {
        lessons: localizedLessons,
        requestedLanguage: preferredLang,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET ACCESSIBLE LESSON CONTEXT (Screen-reader optimized with keyboard shortcuts and breadcrumbs)
export const getAccessibleLessonContext = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { lessonId } = req.params;
    const userId = req.userId;

    if (!mongoose.isValidObjectId(lessonId)) {
      res.status(400).json({ success: false, message: "Invalid lesson ID" });
      return;
    }

    const lesson = await Lesson.findById(lessonId);
    if (!lesson || !lesson.isPublished) {
      res.status(404).json({ success: false, message: "Published lesson not found" });
      return;
    }

    const course = await Course.findById(lesson.course);
    if (!course) {
      res.status(404).json({ success: false, message: "Course not found" });
      return;
    }

    // Verify access
    const isInstructor = userId && course.instructor.toString() === userId;
    const isAdmin = req.userRole === "admin";
    if (!isInstructor && !isAdmin) {
      if (!userId) {
        res.status(401).json({ success: false, message: "Authentication required" });
        return;
      }
      const hasEnrollment = await Enrollment.exists({
        student: userId,
        course: course._id,
        status: "active",
      });
      if (!hasEnrollment) {
        res.status(403).json({ success: false, message: "Active enrollment required" });
        return;
      }
    }

    // Navigation breadcrumbs & prev/next
    const allLessons = await Lesson.find({
      course: course._id,
      isPublished: true,
    })
      .select("_id title order")
      .sort({ order: 1 });

    const currentIndex = allLessons.findIndex(
      (l) => l._id.toString() === lesson._id.toString()
    );
    const previousLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
    const nextLesson =
      currentIndex >= 0 && currentIndex < allLessons.length - 1
        ? allLessons[currentIndex + 1]
        : null;

    res.status(200).json({
      success: true,
      data: {
        lessonId: lesson._id,
        title: lesson.title,
        courseTitle: course.title,
        order: lesson.order,
        durationSeconds: lesson.duration,
        captions: lesson.captions || [],
        transcript: lesson.transcript || "",
        audioDescriptionUrl: lesson.audioDescriptionUrl || null,
        accessibility: {
          estimatedReadingTimeMinutes:
            lesson.accessibility?.estimatedReadingTimeMinutes ||
            Math.ceil(lesson.duration / 60),
          screenReaderNotes:
            lesson.accessibility?.screenReaderNotes ||
            `Lesson ${lesson.order}: ${lesson.title}`,
          hasHighContrastSupport:
            lesson.accessibility?.hasHighContrastSupport ?? true,
          hasCaptions: (lesson.captions || []).length > 0,
          hasTranscript: Boolean(lesson.transcript),
          hasAudioDescription: Boolean(lesson.audioDescriptionUrl),
        },
        navigation: {
          previousLessonId: previousLesson?._id || null,
          previousTitle: previousLesson?.title || null,
          nextLessonId: nextLesson?._id || null,
          nextTitle: nextLesson?.title || null,
          keyboardShortcuts: {
            nextLesson: "Alt + Shift + Right",
            previousLesson: "Alt + Shift + Left",
            toggleCaptions: "C",
            toggleTranscript: "T",
          },
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET COURSE ACCESSIBILITY AUDIT (WCAG 2.1 AA evaluation)
export const getCourseAccessibilityAudit = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { courseId } = req.params;

    if (!mongoose.isValidObjectId(courseId)) {
      res.status(400).json({ success: false, message: "Invalid course ID" });
      return;
    }

    const course = await Course.findById(courseId);
    if (!course) {
      res.status(404).json({ success: false, message: "Course not found" });
      return;
    }

    const lessons = await Lesson.find({
      course: course._id,
      isPublished: true,
    });

    const totalLessons = lessons.length;
    const lessonsWithCaptions = lessons.filter(
      (l) => (l.captions || []).length > 0
    ).length;
    const lessonsWithTranscript = lessons.filter(
      (l) => Boolean(l.transcript)
    ).length;
    const lessonsWithAudioDescription = lessons.filter(
      (l) => Boolean(l.audioDescriptionUrl)
    ).length;

    const captionsPercentage =
      totalLessons > 0
        ? Math.round((lessonsWithCaptions / totalLessons) * 100)
        : 100;
    const transcriptPercentage =
      totalLessons > 0
        ? Math.round((lessonsWithTranscript / totalLessons) * 100)
        : 100;
    const audioDescriptionPercentage =
      totalLessons > 0
        ? Math.round((lessonsWithAudioDescription / totalLessons) * 100)
        : 0;

    const overallScore = Math.round(
      captionsPercentage * 0.4 +
        transcriptPercentage * 0.4 +
        (course.thumbnail ? 10 : 0) +
        audioDescriptionPercentage * 0.1
    );

    const isWcagCompliant =
      captionsPercentage >= 80 && transcriptPercentage >= 80;

    res.status(200).json({
      success: true,
      data: {
        courseId: course._id,
        title: course.title,
        totalLessons,
        metrics: {
          captionsCoveragePercentage: captionsPercentage,
          transcriptCoveragePercentage: transcriptPercentage,
          audioDescriptionPercentage,
          hasThumbnailAltMetadata: Boolean(course.thumbnail),
        },
        compliance: {
          overallScore,
          wcagLevel: isWcagCompliant
            ? "WCAG 2.1 AA Compliant"
            : "Needs Improvement",
          status: isWcagCompliant ? "compliant" : "pending_improvements",
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Add / update lesson translation
export const addLessonTranslation = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const instructorId = req.userId;
    const { lessonId } = req.params;

    if (!instructorId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    if (!mongoose.isValidObjectId(lessonId)) {
      res.status(400).json({
        success: false,
        message: "Invalid lesson ID",
      });
      return;
    }

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      res.status(404).json({
        success: false,
        message: "Lesson not found",
      });
      return;
    }

    const course = await Course.findById(lesson.course);
    if (!course) {
      res.status(404).json({
        success: false,
        message: "Course not found",
      });
      return;
    }

    if (
      course.instructor.toString() !== instructorId &&
      req.userRole !== "admin"
    ) {
      res.status(403).json({
        success: false,
        message: "You can only update translations in your own courses",
      });
      return;
    }

    const { language, title, description, transcript } =
      req.body as LessonTranslationInput;
    const langKey = language.toLowerCase().trim();

    const existingIdx = lesson.translations.findIndex(
      (t) => t.language.toLowerCase() === langKey
    );

    if (existingIdx >= 0) {
      lesson.translations[existingIdx] = {
        language: langKey,
        title,
        description,
        transcript,
      };
    } else {
      lesson.translations.push({
        language: langKey,
        title,
        description,
        transcript,
      });
    }

    await lesson.save();

    res.status(200).json({
      success: true,
      message: `Lesson translation for '${langKey}' saved successfully`,
      data: { lesson },
    });
  } catch (error) {
    next(error);
  }
};

// Update a lesson
export const updateLesson = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const instructorId = req.userId;
    const lessonId = req.params.lessonId;

    if (!instructorId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    if (!lessonId || !mongoose.isValidObjectId(lessonId)) {
      res.status(400).json({
        success: false,
        message: "Invalid lesson ID",
      });
      return;
    }

    const lesson = await Lesson.findById(lessonId);

    if (!lesson) {
      res.status(404).json({
        success: false,
        message: "Lesson not found",
      });
      return;
    }

    const course = await Course.findById(lesson.course);

    if (!course) {
      res.status(404).json({
        success: false,
        message: "Course not found",
      });
      return;
    }

    if (
      course.instructor.toString() !== instructorId &&
      req.userRole !== "admin"
    ) {
      res.status(403).json({
        success: false,
        message: "You can only update lessons in your own courses",
      });
      return;
    }

    const allowedFields = [
      "title",
      "description",
      "videoUrl",
      "duration",
      "order",
      "isPublished",
      "dripType",
      "unlockDate",
      "unlockAfterDays",
      "transcript",
      "audioDescriptionUrl",
      "captions",
      "accessibility",
      "translations",
    ] as const;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === "unlockDate" && req.body[field]) {
          lesson.set(field, new Date(req.body[field]));
        } else {
          lesson.set(field, req.body[field]);
        }
      }
    }

    await lesson.save();

    res.status(200).json({
      success: true,
      message: "Lesson updated successfully",
      data: { lesson },
    });
  } catch (error) {
    if (
      error instanceof mongoose.mongo.MongoServerError &&
      error.code === 11000
    ) {
      res.status(409).json({
        success: false,
        message: "A lesson with this order already exists in this course",
      });
      return;
    }

    next(error);
  }
};

// Delete a lesson
export const deleteLesson = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const instructorId = req.userId;
    const lessonId = req.params.lessonId;

    if (!instructorId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    if (!lessonId || !mongoose.isValidObjectId(lessonId)) {
      res.status(400).json({
        success: false,
        message: "Invalid lesson ID",
      });
      return;
    }

    const lesson = await Lesson.findById(lessonId);

    if (!lesson) {
      res.status(404).json({
        success: false,
        message: "Lesson not found",
      });
      return;
    }

    const course = await Course.findById(lesson.course);

    if (!course) {
      res.status(404).json({
        success: false,
        message: "Course not found",
      });
      return;
    }

    if (
      course.instructor.toString() !== instructorId &&
      req.userRole !== "admin"
    ) {
      res.status(403).json({
        success: false,
        message: "You can only delete lessons in your own courses",
      });
      return;
    }

    await lesson.deleteOne();

    res.status(200).json({
      success: true,
      message: "Lesson deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Reorder lessons within a course
export const reorderLessons = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const instructorId = req.userId;
    const courseId = req.params.courseId;
    const { lessonIds } = req.body as { lessonIds?: string[] };

    if (!instructorId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    if (!courseId || !mongoose.isValidObjectId(courseId)) {
      res.status(400).json({
        success: false,
        message: "Invalid course ID",
      });
      return;
    }

    if (
      !Array.isArray(lessonIds) ||
      lessonIds.length === 0 ||
      !lessonIds.every(
        (id) => typeof id === "string" && mongoose.isValidObjectId(id)
      )
    ) {
      res.status(400).json({
        success: false,
        message: "lessonIds must be a non-empty array of valid lesson IDs",
      });
      return;
    }

    if (new Set(lessonIds).size !== lessonIds.length) {
      res.status(400).json({
        success: false,
        message: "Duplicate lesson IDs are not allowed",
      });
      return;
    }

    const course = await Course.findById(courseId);

    if (!course) {
      res.status(404).json({
        success: false,
        message: "Course not found",
      });
      return;
    }

    if (
      course.instructor.toString() !== instructorId &&
      req.userRole !== "admin"
    ) {
      res.status(403).json({
        success: false,
        message: "You can only reorder lessons in your own courses",
      });
      return;
    }

    const lessons = await Lesson.find({
      course: course._id,
    }).select("_id order");

    if (
      lessons.length !== lessonIds.length ||
      !lessons.every((lesson) =>
        lessonIds.includes(lesson._id.toString())
      )
    ) {
      res.status(400).json({
        success: false,
        message: "Provide every lesson ID belonging to this course exactly once",
      });
      return;
    }

    // Move lessons to temporary unique order values first
    const temporaryOffset = lessons.length + 1;

    for (let index = 0; index < lessonIds.length; index++) {
      await Lesson.updateOne(
        {
          _id: lessonIds[index],
          course: course._id,
        },
        {
          $set: {
            order: -(index + 1 + temporaryOffset),
          },
        }
      );
    }

    // Apply the final order: 1, 2, 3, ...
    for (let index = 0; index < lessonIds.length; index++) {
      await Lesson.updateOne(
        {
          _id: lessonIds[index],
          course: course._id,
        },
        {
          $set: {
            order: index + 1,
          },
        }
      );
    }

    const reorderedLessons = await Lesson.find({
      course: course._id,
    }).sort({ order: 1 });

    res.status(200).json({
      success: true,
      message: "Lessons reordered successfully",
      data: {
        lessons: reorderedLessons,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const toggleLessonPublish = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const instructorId = req.userId;
    const { lessonId } = req.params;

    if (!instructorId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    if (!mongoose.isValidObjectId(lessonId)) {
      res.status(400).json({
        success: false,
        message: "Invalid lesson ID",
      });
      return;
    }

    const lesson = await Lesson.findById(lessonId);

    if (!lesson) {
      res.status(404).json({
        success: false,
        message: "Lesson not found",
      });
      return;
    }

    const course = await Course.findById(lesson.course);

    if (!course) {
      res.status(404).json({
        success: false,
        message: "Course not found",
      });
      return;
    }

    if (
      course.instructor.toString() !== instructorId &&
      req.userRole !== "admin"
    ) {
      res.status(403).json({
        success: false,
        message: "You can only publish lessons in your own courses",
      });
      return;
    }

    lesson.isPublished = !lesson.isPublished;
    await lesson.save();

    res.status(200).json({
      success: true,
      message: lesson.isPublished
        ? "Lesson published successfully"
        : "Lesson unpublished successfully",
      data: { lesson },
    });
  } catch (error) {
    next(error);
  }
};
