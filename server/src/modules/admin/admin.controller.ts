import { User } from "../auth/auth.model";
import { Course } from "../courses/course.model";
import Enrollment from "../enrollments/enrollment.model";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import type { AuthRequest } from "../../middlewares/auth.middleware";
import mongoose from "mongoose";

// ==========================================
// ADMIN DASHBOARD
// ==========================================

export const getAdminDashboard = asyncHandler(async (req, res) => {
  const authReq = req as AuthRequest;

  if (!authReq.userId) {
    throw new ApiError(401, "Authentication required");
  }

  if (authReq.userRole !== "admin") {
    throw new ApiError(403, "Admin access required");
  }

  const [
    totalUsers,
    totalStudents,
    totalInstructors,
    totalCourses,
    publishedCourses,
    unpublishedCourses,
    totalEnrollments,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: "student" }),
    User.countDocuments({ role: "instructor" }),
    Course.countDocuments(),
    Course.countDocuments({ isPublished: true }),
    Course.countDocuments({ isPublished: false }),
    Enrollment.countDocuments(),
  ]);

  res.status(200).json({
    success: true,
    message: "Admin dashboard fetched successfully",
    data: {
      users: {
        total: totalUsers,
        students: totalStudents,
        instructors: totalInstructors,
      },
      courses: {
        total: totalCourses,
        published: publishedCourses,
        unpublished: unpublishedCourses,
      },
      totalEnrollments,
    },
  });
});

// ==========================================
// GET ALL USERS + SEARCH + ROLE FILTER
// ==========================================

export const getAllUsers = asyncHandler(async (req, res) => {
  const authReq = req as AuthRequest;

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
  const skip = (page - 1) * limit;

  const search =
    typeof req.query.search === "string" ? req.query.search.trim() : "";

  const role =
    typeof req.query.role === "string" ? req.query.role : undefined;

  const isActive =
    typeof req.query.isActive === "string"
      ? req.query.isActive
      : undefined;

  const filter: Record<string, unknown> = {};

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  if (role) {
    if (!["student", "instructor", "admin"].includes(role)) {
      throw new ApiError(400, "Invalid user role");
    }

    filter.role = role;
  }

  if (isActive !== undefined) {
    if (isActive !== "true" && isActive !== "false") {
      throw new ApiError(400, "isActive must be true or false");
    }

    filter.isActive = isActive === "true";
  }

  const [users, totalUsers] = await Promise.all([
    User.find(filter)
      .select("-password -passwordResetToken -passwordResetExpires")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    User.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    message: "Users fetched successfully",
    data: {
      users,
      pagination: {
        totalUsers,
        currentPage: page,
        totalPages: Math.ceil(totalUsers / limit),
        limit,
      },
    },
  });
});

// ==========================================
// GET USER DETAILS BY ID
// ==========================================
export const getUserById = asyncHandler(async (req, res) => {
  const userId = String(req.params.userId);

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  const user = await User.findById(userId).select(
    "-password -passwordResetToken -passwordResetExpires"
  );

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  res.status(200).json({
    success: true,
    message: "User details fetched successfully",
    data: user,
  });
});

// ==========================================
// ACTIVATE / DEACTIVATE USER
// ==========================================

export const updateUserStatus = asyncHandler(async (req, res) => {
  const authReq = req as AuthRequest;
  const userId = String(req.params.userId);
  const { isActive } = req.body as { isActive?: boolean };

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  if (typeof isActive !== "boolean") {
    throw new ApiError(400, "isActive must be a boolean");
  }

  if (authReq.userId === userId && isActive === false) {
    throw new ApiError(400, "You cannot deactivate your own account");
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  user.isActive = isActive;
  await user.save();

  res.status(200).json({
    success: true,
    message: `User ${isActive ? "activated" : "deactivated"} successfully`,
    data: {
      userId: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    },
  });
});

// ==========================================
// GET ALL COURSES + SEARCH + FILTER
// ==========================================

export const getAllCourses = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
  const skip = (page - 1) * limit;

  const search =
    typeof req.query.search === "string"
      ? req.query.search.trim()
      : "";

  const isPublished =
    typeof req.query.isPublished === "string"
      ? req.query.isPublished
      : undefined;

  const filter: Record<string, unknown> = {};

  // Search by course title
  if (search) {
    filter.title = {
      $regex: search,
      $options: "i",
    };
  }

  // Filter published / unpublished courses
  if (isPublished !== undefined) {
    if (isPublished !== "true" && isPublished !== "false") {
      throw new ApiError(400, "isPublished must be true or false");
    }

    filter.isPublished = isPublished === "true";
  }

  const [courses, totalCourses] = await Promise.all([
    Course.find(filter)
      .populate("instructor", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Course.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    message: "Courses fetched successfully",
    data: {
      courses,
      pagination: {
        totalCourses,
        currentPage: page,
        totalPages: Math.ceil(totalCourses / limit),
        limit,
      },
    },
  });
});

// ==========================================
// GET COURSE DETAILS BY ID
// ==========================================

export const getCourseById = asyncHandler(async (req, res) => {
  const courseId = String(req.params.courseId);

  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    throw new ApiError(400, "Invalid course ID");
  }

  const course = await Course.findById(courseId)
    .populate("instructor", "name email")
    .lean();

  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  res.status(200).json({
    success: true,
    message: "Course details fetched successfully",
    data: course,
  });
});

// ==========================================
// APPROVE / PUBLISH COURSE
// ==========================================

export const approveCourse = asyncHandler(async (req, res) => {
  const courseId = String(req.params.courseId);

  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    throw new ApiError(400, "Invalid course ID");
  }

  const course = await Course.findById(courseId);

  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  course.isPublished = true;
  await course.save();

  res.status(200).json({
    success: true,
    message: "Course approved and published successfully",
    data: {
      courseId: course._id,
      title: course.title,
      isPublished: course.isPublished,
    },
  });
});

// ==========================================
// REJECT / UNPUBLISH COURSE
// ==========================================

export const rejectCourse = asyncHandler(async (req, res) => {
  const courseId = String(req.params.courseId);

  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    throw new ApiError(400, "Invalid course ID");
  }

  const course = await Course.findById(courseId);

  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  course.isPublished = false;
  await course.save();

  res.status(200).json({
    success: true,
    message: "Course unpublished successfully",
    data: {
      courseId: course._id,
      title: course.title,
      isPublished: course.isPublished,
    },
  });
});

// ==========================================
// DELETE COURSE
// ==========================================

export const adminDeleteCourse = asyncHandler(async (req, res) => {
  const courseId = String(req.params.courseId);

  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    throw new ApiError(400, "Invalid course ID");
  }

  const course = await Course.findById(courseId);

  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  await Course.findByIdAndDelete(courseId);

  res.status(200).json({
    success: true,
    message: "Course deleted successfully",
  });
});