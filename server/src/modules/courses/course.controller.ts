import type { Response } from "express";
import mongoose from "mongoose";

import { Course } from "./course.model";
import type {
  CreateCourseInput,
  UpdateCourseInput,
  CourseQueryInput,
  CourseTranslationInput,
} from "./course.validation";

import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import type { AuthRequest } from "../../middlewares/auth.middleware";
import { getPreferredLanguage, localizeCourse } from "../../utils/language";

const getUserId = (req: AuthRequest): string => {
  if (!req.userId) {
    throw new ApiError(401, "Authentication required");
  }

  return req.userId;
};

const sendCourse = (res: Response, statusCode: number, course: unknown) => {
  res.status(statusCode).json({
    success: true,
    data: { course },
  });
};

// CREATE COURSE — Instructor/Admin
export const createCourse = asyncHandler(async (req, res) => {
  const authReq = req as AuthRequest;
  const userId = getUserId(authReq);

  const body = req.body as CreateCourseInput;

  const course = await Course.create({
    ...body,
    instructor: userId,
  });

  sendCourse(res, 201, course);
});

// GET ALL PUBLISHED COURSES — Search, Filter, Pagination, Localization
export const getCourses = asyncHandler(async (req, res) => {
  const query = req.query as unknown as CourseQueryInput;

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

  switch (query.sort) {
    case "oldest":
      sort = { createdAt: 1 };
      break;
    case "price-low":
      sort = { price: 1 };
      break;
    case "price-high":
      sort = { price: -1 };
      break;
    default:
      sort = { createdAt: -1 };
  }

  const [courses, total] = await Promise.all([
    Course.find(filter)
      .populate("instructor", "name")
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Course.countDocuments(filter),
  ]);

  const preferredLang = getPreferredLanguage(req);
  const localizedCourses = courses.map((course) =>
    localizeCourse(course, preferredLang)
  );

  res.status(200).json({
    success: true,
    data: {
      courses: localizedCourses,
      requestedLanguage: preferredLang,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
});

// GET SINGLE PUBLISHED COURSE (with localized fields)
export const getCourseById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, "Invalid course ID");
  }

  const course = await Course.findOne({
    _id: id,
    isPublished: true,
  })
    .populate("instructor", "name")
    .populate("prerequisites", "title level thumbnail isPublished");

  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  const preferredLang = getPreferredLanguage(req);
  const localizedCourse = localizeCourse(course.toObject(), preferredLang);

  sendCourse(res, 200, localizedCourse);
});

// ADD / UPDATE COURSE TRANSLATION — Instructor/Admin
export const addCourseTranslation = asyncHandler(async (req, res) => {
  const authReq = req as AuthRequest;
  const userId = getUserId(authReq);
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, "Invalid course ID");
  }

  const course = await Course.findById(id);

  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  const isOwner = course.instructor.toString() === userId;
  const isAdmin = authReq.userRole === "admin";

  if (!isOwner && !isAdmin) {
    throw new ApiError(403, "You cannot update translations for this course");
  }

  const { language, title, description, shortDescription } =
    req.body as CourseTranslationInput;
  const langKey = language.toLowerCase().trim();

  const existingIdx = course.translations.findIndex(
    (t) => t.language.toLowerCase() === langKey
  );

  if (existingIdx >= 0) {
    course.translations[existingIdx] = {
      language: langKey,
      title,
      description,
      shortDescription,
    };
  } else {
    course.translations.push({
      language: langKey,
      title,
      description,
      shortDescription,
    });
    if (!course.supportedLanguages.includes(langKey)) {
      course.supportedLanguages.push(langKey);
    }
  }

  await course.save();

  res.status(200).json({
    success: true,
    message: `Translation for language '${langKey}' saved successfully`,
    data: {
      courseId: course._id,
      supportedLanguages: course.supportedLanguages,
      translations: course.translations,
    },
  });
});

// UPDATE OWN COURSE — Instructor/Admin
export const updateCourse = asyncHandler(async (req, res) => {
  const authReq = req as AuthRequest;
  const userId = getUserId(authReq);
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, "Invalid course ID");
  }

  const updates = req.body as UpdateCourseInput;

  const course = await Course.findById(id);

  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  const isOwner = course.instructor.toString() === userId;
  const isAdmin = authReq.userRole === "admin";

  if (!isOwner && !isAdmin) {
    throw new ApiError(403, "You cannot update this course");
  }

  course.set(updates);
  await course.save();

  sendCourse(res, 200, course);
});

// DELETE OWN COURSE — Instructor/Admin
export const deleteCourse = asyncHandler(async (req, res) => {
  const authReq = req as AuthRequest;
  const userId = getUserId(authReq);
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, "Invalid course ID");
  }

  const course = await Course.findById(id);

  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  const isOwner = course.instructor.toString() === userId;
  const isAdmin = authReq.userRole === "admin";

  if (!isOwner && !isAdmin) {
    throw new ApiError(403, "You cannot delete this course");
  }

  await course.deleteOne();

  res.status(200).json({
    success: true,
    message: "Course deleted successfully",
  });
});

// GET MY COURSES — Instructor/Admin
export const getMyCourses = asyncHandler(async (req, res) => {
  const authReq = req as AuthRequest;
  const userId = getUserId(authReq);

  const courses = await Course.find({
    instructor: userId,
  }).sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: { courses },
  });
});

// PUBLISH / UNPUBLISH OWN COURSE — Instructor/Admin
export const toggleCoursePublish = asyncHandler(async (req, res) => {
  const authReq = req as AuthRequest;
  const userId = getUserId(authReq);
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, "Invalid course ID");
  }

  const course = await Course.findById(id);

  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  const isOwner = course.instructor.toString() === userId;
  const isAdmin = authReq.userRole === "admin";

  if (!isOwner && !isAdmin) {
    throw new ApiError(403, "You cannot publish this course");
  }

  course.isPublished = !course.isPublished;
  await course.save();

  res.status(200).json({
    success: true,
    message: course.isPublished
      ? "Course published successfully"
      : "Course unpublished successfully",
    data: { course },
  });
});
