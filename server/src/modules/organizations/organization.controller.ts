import type { Response } from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import { Organization } from "./organization.model";
import { User } from "../auth/auth.model";
import { Course } from "../courses/course.model";
import Enrollment from "../enrollments/enrollment.model";
import Lesson from "../lessons/lesson.model";
import Progress from "../progress/progress.model";
import { Certificate } from "../certificates/certificate.model";
import { LearningSession } from "../learningTime/learningSession.model";

import {
  type CreateOrganizationInput,
  type UpdateOrganizationInput,
  type AddMemberInput,
  type AssignCourseInput,
  type BulkEnrollInput,
} from "./organization.validation";

import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import type { AuthRequest } from "../../middlewares/auth.middleware";

// CREATE ORGANIZATION — System Admin Only
export const createOrganization = asyncHandler(async (req, res: Response) => {
  const authReq = req as AuthRequest;

  if (authReq.userRole !== "admin") {
    throw new ApiError(403, "Only system administrators can create organizations");
  }

  const {
    name,
    slug,
    code,
    domain,
    description,
    website,
    adminEmail,
    maxStudents = 500,
  } = req.body as CreateOrganizationInput;

  // Check unique slug and code
  const existingSlug = await Organization.findOne({ slug: slug.toLowerCase() });
  if (existingSlug) {
    throw new ApiError(409, `Organization slug '${slug}' is already in use`);
  }

  const existingCode = await Organization.findOne({ code: code.toUpperCase() });
  if (existingCode) {
    throw new ApiError(409, `Organization code '${code}' is already in use`);
  }

  const adminUsers: mongoose.Types.ObjectId[] = [];

  // Create Organization document first
  const organization = await Organization.create({
    name,
    slug: slug.toLowerCase(),
    code: code.toUpperCase(),
    domain: domain?.toLowerCase(),
    description,
    website,
    adminUsers,
    instructors: [],
    students: [],
    courses: [],
    settings: {
      allowOpenRegistration: false,
      requireDomainMatch: Boolean(domain),
      maxStudents,
      features: {
        analytics: true,
        certificates: true,
        codeReview: true,
      },
    },
    isActive: true,
  });

  // Assign or provision initial Org Admin if provided
  if (adminEmail) {
    const normalizedEmail = adminEmail.trim().toLowerCase();
    let adminUser = await User.findOne({ email: normalizedEmail });

    if (adminUser) {
      adminUser.role = "org_admin";
      adminUser.organization = organization._id as mongoose.Types.ObjectId;
      await adminUser.save();
    } else {
      const defaultPassword = await bcrypt.hash("OrgAdmin123!", 10);
      adminUser = await User.create({
        name: `${name} Administrator`,
        email: normalizedEmail,
        password: defaultPassword,
        role: "org_admin",
        organization: organization._id,
        isEmailVerified: true,
        isActive: true,
      });
    }

    organization.adminUsers.push(adminUser._id as mongoose.Types.ObjectId);
    await organization.save();
  }

  res.status(201).json({
    success: true,
    message: "Organization created successfully",
    data: organization,
  });
});

// GET ALL ORGANIZATIONS — Admin (all) or Org Admin (own)
export const getOrganizations = asyncHandler(async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;
  const userRole = authReq.userRole;

  let filter: Record<string, any> = {};

  if (userRole === "org_admin") {
    filter = { adminUsers: new mongoose.Types.ObjectId(userId) };
  } else if (userRole !== "admin") {
    throw new ApiError(403, "Access denied to organization records");
  }

  const organizations = await Organization.find(filter)
    .populate("adminUsers", "name email")
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: organizations.length,
    data: organizations,
  });
});

// GET ORGANIZATION BY ID — Admin or Assigned Org Admin
export const getOrganizationById = asyncHandler(async (req, res: Response) => {
  const orgId = typeof req.params.id === "string" ? req.params.id : "";

  if (!mongoose.Types.ObjectId.isValid(orgId)) {
    throw new ApiError(400, "Invalid organization ID format");
  }

  const organization = await Organization.findById(orgId)
    .populate("adminUsers", "name email")
    .populate("instructors", "name email")
    .populate("courses", "title category level price isPublished");

  if (!organization) {
    throw new ApiError(404, "Organization not found");
  }

  res.status(200).json({
    success: true,
    data: organization,
  });
});

// UPDATE ORGANIZATION — Admin or Org Admin
export const updateOrganization = asyncHandler(async (req, res: Response) => {
  const orgId = typeof req.params.id === "string" ? req.params.id : "";

  if (!mongoose.Types.ObjectId.isValid(orgId)) {
    throw new ApiError(400, "Invalid organization ID format");
  }

  const updates = req.body as UpdateOrganizationInput;

  const organization = await Organization.findByIdAndUpdate(
    orgId,
    { $set: updates },
    { new: true, runValidators: true }
  );

  if (!organization) {
    throw new ApiError(404, "Organization not found");
  }

  res.status(200).json({
    success: true,
    message: "Organization updated successfully",
    data: organization,
  });
});

// ADD MEMBER (STUDENT / INSTRUCTOR / ORG_ADMIN) — Org Admin or Admin
export const addMember = asyncHandler(async (req, res: Response) => {
  const orgId = typeof req.params.id === "string" ? req.params.id : "";

  if (!mongoose.Types.ObjectId.isValid(orgId)) {
    throw new ApiError(400, "Invalid organization ID format");
  }

  const organization = await Organization.findById(orgId);
  if (!organization) {
    throw new ApiError(404, "Organization not found");
  }

  const { email, role = "student", name } = req.body as AddMemberInput;
  const normalizedEmail = email.trim().toLowerCase();

  let user = await User.findOne({ email: normalizedEmail });

  if (user) {
    // Associate user with organization
    user.organization = organization._id as mongoose.Types.ObjectId;
    if (role === "instructor" && user.role === "student") {
      user.role = "instructor";
    } else if (role === "org_admin") {
      user.role = "org_admin";
    }
    await user.save();
  } else {
    // Auto-provision user
    const defaultPassword = await bcrypt.hash("SkillForge123!", 10);
    user = await User.create({
      name: name || normalizedEmail.split("@")[0],
      email: normalizedEmail,
      password: defaultPassword,
      role,
      organization: organization._id,
      isEmailVerified: true,
      isActive: true,
    });
  }

  const userObjectId = user._id as mongoose.Types.ObjectId;

  if (role === "student") {
    if (!organization.students.some((id) => id.toString() === userObjectId.toString())) {
      organization.students.push(userObjectId);
    }
  } else if (role === "instructor") {
    if (!organization.instructors.some((id) => id.toString() === userObjectId.toString())) {
      organization.instructors.push(userObjectId);
    }
  } else if (role === "org_admin") {
    if (!organization.adminUsers.some((id) => id.toString() === userObjectId.toString())) {
      organization.adminUsers.push(userObjectId);
    }
  }

  await organization.save();

  res.status(200).json({
    success: true,
    message: `User ${normalizedEmail} added as ${role} to organization`,
    data: {
      userId: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      organization: organization._id,
    },
  });
});

// REMOVE MEMBER — Org Admin or Admin
export const removeMember = asyncHandler(async (req, res: Response) => {
  const orgId = typeof req.params.id === "string" ? req.params.id : "";
  const memberId = typeof req.params.memberId === "string" ? req.params.memberId : "";

  if (!mongoose.Types.ObjectId.isValid(orgId) || !mongoose.Types.ObjectId.isValid(memberId)) {
    throw new ApiError(400, "Invalid ID format");
  }

  const organization = await Organization.findById(orgId);
  if (!organization) {
    throw new ApiError(404, "Organization not found");
  }

  organization.students = organization.students.filter(
    (id) => id.toString() !== memberId
  );
  organization.instructors = organization.instructors.filter(
    (id) => id.toString() !== memberId
  );
  organization.adminUsers = organization.adminUsers.filter(
    (id) => id.toString() !== memberId
  );

  await organization.save();

  // Clear organization field on user
  await User.findByIdAndUpdate(memberId, { $unset: { organization: 1 } });

  res.status(200).json({
    success: true,
    message: "Member removed from organization successfully",
  });
});

// ASSIGN COURSE TO ORGANIZATION — Org Admin or Admin
export const assignCourse = asyncHandler(async (req, res: Response) => {
  const orgId = typeof req.params.id === "string" ? req.params.id : "";
  const { courseId } = req.body as AssignCourseInput;

  if (!mongoose.Types.ObjectId.isValid(orgId) || !mongoose.Types.ObjectId.isValid(courseId)) {
    throw new ApiError(400, "Invalid ID format");
  }

  const organization = await Organization.findById(orgId);
  if (!organization) {
    throw new ApiError(404, "Organization not found");
  }

  const course = await Course.findById(courseId);
  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  const courseObjectId = new mongoose.Types.ObjectId(courseId);

  if (!organization.courses.some((id) => id.toString() === courseId)) {
    organization.courses.push(courseObjectId);
    await organization.save();
  }

  res.status(200).json({
    success: true,
    message: `Course '${course.title}' assigned to organization curriculum`,
    data: organization.courses,
  });
});

// REMOVE COURSE FROM ORGANIZATION — Org Admin or Admin
export const removeCourse = asyncHandler(async (req, res: Response) => {
  const orgId = typeof req.params.id === "string" ? req.params.id : "";
  const courseId = typeof req.params.courseId === "string" ? req.params.courseId : "";

  if (!mongoose.Types.ObjectId.isValid(orgId) || !mongoose.Types.ObjectId.isValid(courseId)) {
    throw new ApiError(400, "Invalid ID format");
  }

  const organization = await Organization.findById(orgId);
  if (!organization) {
    throw new ApiError(404, "Organization not found");
  }

  organization.courses = organization.courses.filter(
    (id) => id.toString() !== courseId
  );
  await organization.save();

  res.status(200).json({
    success: true,
    message: "Course removed from organization curriculum",
  });
});

// GET ORGANIZATION MEMBERS — Org Admin or Admin
export const getOrganizationMembers = asyncHandler(async (req, res: Response) => {
  const orgId = typeof req.params.id === "string" ? req.params.id : "";
  const roleFilter = typeof req.query.role === "string" ? req.query.role : undefined;

  if (!mongoose.Types.ObjectId.isValid(orgId)) {
    throw new ApiError(400, "Invalid organization ID format");
  }

  const query: Record<string, any> = { organization: new mongoose.Types.ObjectId(orgId) };
  if (roleFilter) {
    query.role = roleFilter;
  }

  const members = await User.find(query)
    .select("_id name email role createdAt isActive")
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: members.length,
    data: members,
  });
});

// BULK ENROLL STUDENTS — Org Admin or Admin
export const bulkEnrollStudents = asyncHandler(async (req, res: Response) => {
  const orgId = typeof req.params.id === "string" ? req.params.id : "";

  if (!mongoose.Types.ObjectId.isValid(orgId)) {
    throw new ApiError(400, "Invalid organization ID format");
  }

  const organization = await Organization.findById(orgId);
  if (!organization) {
    throw new ApiError(404, "Organization not found");
  }

  const { courseIds, students } = req.body as BulkEnrollInput;

  // Validate courses exist
  const courses = await Course.find({ _id: { $in: courseIds } }).select("_id title");
  if (courses.length !== courseIds.length) {
    throw new ApiError(400, "One or more course IDs are invalid");
  }

  // Ensure organization capacity is not exceeded
  const currentStudentCount = organization.students.length;
  const maxCapacity = organization.settings.maxStudents || 500;
  if (currentStudentCount + students.length > maxCapacity) {
    throw new ApiError(
      400,
      `Bulk enrollment exceeds organization capacity (${currentStudentCount}/${maxCapacity} active seats)`
    );
  }

  let createdCount = 0;
  let enrolledCount = 0;
  let alreadyEnrolledCount = 0;
  const errors: Array<{ email: string; reason: string }> = [];

  const defaultPassword = await bcrypt.hash("Student123!", 10);

  for (const item of students) {
    try {
      const normalizedEmail = item.email.trim().toLowerCase();

      // Find or provision student
      let user = await User.findOne({ email: normalizedEmail });

      if (!user) {
        user = await User.create({
          name: item.name || normalizedEmail.split("@")[0],
          email: normalizedEmail,
          password: defaultPassword,
          role: "student",
          organization: organization._id,
          isEmailVerified: true,
          isActive: true,
        });
        createdCount++;
      } else if (!user.organization) {
        user.organization = organization._id as mongoose.Types.ObjectId;
        await user.save();
      }

      const userObjectId = user._id as mongoose.Types.ObjectId;

      // Add to organization student list if not present
      if (!organization.students.some((id) => id.toString() === userObjectId.toString())) {
        organization.students.push(userObjectId);
      }

      // Enroll in each course
      for (const courseId of courseIds) {
        const courseObjectId = new mongoose.Types.ObjectId(courseId);

        const existingEnrollment = await Enrollment.findOne({
          student: userObjectId,
          course: courseObjectId,
        });

        if (existingEnrollment) {
          if (existingEnrollment.status !== "active") {
            existingEnrollment.status = "active";
            existingEnrollment.paymentStatus = "paid";
            await existingEnrollment.save();
            enrolledCount++;
          } else {
            alreadyEnrolledCount++;
          }
        } else {
          await Enrollment.create({
            student: userObjectId,
            course: courseObjectId,
            status: "active",
            paymentStatus: "paid",
            amount: 0,
            enrolledAt: new Date(),
          });

          // Initialize Progress
          await Progress.create({
            student: userObjectId,
            course: courseObjectId,
            completedLessons: [],
          });

          enrolledCount++;
        }
      }
    } catch (err: any) {
      errors.push({
        email: item.email,
        reason: err.message || "Enrollment processing failed",
      });
    }
  }

  await organization.save();

  res.status(200).json({
    success: true,
    message: `Bulk enrollment completed: ${enrolledCount} course enrollments created`,
    data: {
      totalProcessed: students.length,
      createdCount,
      enrolledCount,
      alreadyEnrolledCount,
      failedCount: errors.length,
      errors,
    },
  });
});

// ORGANIZATION-LEVEL ANALYTICS — Org Admin or Admin
export const getOrganizationAnalytics = asyncHandler(
  async (req, res: Response) => {
    const orgId = typeof req.params.id === "string" ? req.params.id : "";

    if (!mongoose.Types.ObjectId.isValid(orgId)) {
      throw new ApiError(400, "Invalid organization ID format");
    }

    const organization = await Organization.findById(orgId).populate(
      "courses",
      "title level category price"
    );

    if (!organization) {
      throw new ApiError(404, "Organization not found");
    }

    const studentIds = organization.students;
    const courseIds = organization.courses.map((c: any) => c._id);

    const totalStudents = studentIds.length;
    const totalInstructors = organization.instructors.length;
    const totalCourses = organization.courses.length;

    // Active enrollments for this org's students in this org's courses
    const activeEnrollments = await Enrollment.find({
      student: { $in: studentIds },
      course: { $in: courseIds },
      status: "active",
    }).lean();

    const activeEnrollmentsCount = activeEnrollments.length;

    // Course-wise Breakdown & Funnel
    const courseBreakdown = [];
    let completedEnrollmentsCount = 0;

    for (const c of organization.courses as any[]) {
      const courseId = c._id;
      const enrolledInCourse = activeEnrollments.filter(
        (e) => e.course.toString() === courseId.toString()
      ).length;

      const publishedLessonCount = await Lesson.countDocuments({
        course: courseId,
        isPublished: true,
      });

      const progressRecords = await Progress.find({
        course: courseId,
        student: { $in: studentIds },
      }).lean();

      let completedInCourse = 0;
      for (const p of progressRecords) {
        if (
          publishedLessonCount > 0 &&
          p.completedLessons.length >= publishedLessonCount
        ) {
          completedInCourse++;
          completedEnrollmentsCount++;
        }
      }

      const completionRate =
        enrolledInCourse > 0
          ? Math.round((completedInCourse / enrolledInCourse) * 100)
          : 0;

      courseBreakdown.push({
        courseId: c._id,
        title: c.title,
        category: c.category,
        enrolledStudents: enrolledInCourse,
        completedStudents: completedInCourse,
        completionRate,
      });
    }

    const overallCompletionRate =
      activeEnrollmentsCount > 0
        ? Math.round((completedEnrollmentsCount / activeEnrollmentsCount) * 100)
        : 0;

    // Total learning time logged by org students
    const learningAgg = await LearningSession.aggregate([
      {
        $match: {
          student: { $in: studentIds },
          course: { $in: courseIds },
        },
      },
      {
        $group: {
          _id: null,
          totalSeconds: { $sum: "$totalActiveSeconds" },
          sessionCount: { $sum: 1 },
        },
      },
    ]);

    const totalLearningSeconds = learningAgg[0]?.totalSeconds || 0;
    const totalLearningHours =
      Math.round((totalLearningSeconds / 3600) * 10) / 10;

    // Certificates issued to org students
    const certificatesCount = await Certificate.countDocuments({
      student: { $in: studentIds },
      course: { $in: courseIds },
      status: { $in: ["active", "renewed"] },
    });

    res.status(200).json({
      success: true,
      data: {
        organization: {
          id: organization._id,
          name: organization.name,
          code: organization.code,
          slug: organization.slug,
          maxCapacity: organization.settings.maxStudents,
          seatUtilizationPercentage:
            organization.settings.maxStudents > 0
              ? Math.round(
                  (totalStudents / organization.settings.maxStudents) * 100
                )
              : 0,
        },
        summary: {
          totalStudents,
          totalInstructors,
          totalCourses,
          activeEnrollmentsCount,
          completedEnrollmentsCount,
          overallCompletionRate,
          totalLearningHours,
          certificatesIssued: certificatesCount,
        },
        courseBreakdown,
        timestamp: new Date(),
      },
    });
  }
);
