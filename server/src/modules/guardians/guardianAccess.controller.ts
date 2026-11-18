import type { Response } from "express";
import crypto from "node:crypto";
import mongoose from "mongoose";

import { GuardianAccess } from "./guardianAccess.model";
import { User } from "../auth/auth.model";
import { Course } from "../courses/course.model";
import Enrollment from "../enrollments/enrollment.model";
import Lesson from "../lessons/lesson.model";
import Progress from "../progress/progress.model";
import { Certificate } from "../certificates/certificate.model";
import { LearningSession } from "../learningTime/learningSession.model";

import {
  type InviteGuardianInput,
  type UpdateGuardianPermissionsInput,
} from "./guardianAccess.validation";

import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import type { AuthRequest } from "../../middlewares/auth.middleware";

// INVITE GUARDIAN — Student
export const inviteGuardian = asyncHandler(async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const studentId = authReq.userId;

  if (!studentId) {
    throw new ApiError(401, "Authentication required");
  }

  const studentUser = await User.findById(studentId);
  if (!studentUser) {
    throw new ApiError(404, "Student record not found");
  }

  const {
    guardianEmail,
    relationship = "parent",
    permissions,
  } = req.body as InviteGuardianInput;

  const normalizedEmail = guardianEmail.trim().toLowerCase();

  // Guard: Student cannot invite themselves
  if (normalizedEmail === studentUser.email.toLowerCase()) {
    throw new ApiError(400, "You cannot invite yourself as a guardian");
  }

  // Check if guardian already has an active or pending link
  let link = await GuardianAccess.findOne({
    student: studentId,
    guardianEmail: normalizedEmail,
  });

  const inviteToken = crypto.randomBytes(24).toString("hex");

  if (link) {
    if (link.status === "accepted") {
      throw new ApiError(409, "Guardian is already actively linked to your account");
    }
    // Re-issue pending invite
    link.status = "pending";
    link.inviteToken = inviteToken;
    link.relationship = relationship;
    if (permissions) {
      link.permissions = { ...link.permissions, ...permissions };
    }
    link.invitedAt = new Date();
    link.revokedAt = undefined;
    await link.save();
  } else {
    link = await GuardianAccess.create({
      student: studentId,
      guardianEmail: normalizedEmail,
      relationship,
      inviteToken,
      status: "pending",
      permissions: {
        viewCourses: permissions?.viewCourses ?? true,
        viewProgress: permissions?.viewProgress ?? true,
        viewCertificates: permissions?.viewCertificates ?? true,
        viewAttendanceTime: permissions?.viewAttendanceTime ?? true,
      },
      invitedAt: new Date(),
    });
  }

  res.status(201).json({
    success: true,
    message: `Invitation sent to ${normalizedEmail}`,
    data: {
      id: link._id,
      guardianEmail: link.guardianEmail,
      relationship: link.relationship,
      status: link.status,
      inviteToken: link.inviteToken,
      permissions: link.permissions,
    },
  });
});

// ACCEPT GUARDIAN INVITATION — Guardian User
export const acceptGuardianInvite = asyncHandler(async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const guardianUserId = authReq.userId;
  const rawToken = req.params.inviteToken;
  const inviteToken = typeof rawToken === "string" ? rawToken.trim() : "";

  if (!guardianUserId) {
    throw new ApiError(401, "Authentication required to accept invitation");
  }

  if (!inviteToken) {
    throw new ApiError(400, "Invite token is required");
  }

  const link = await GuardianAccess.findOne({ inviteToken });
  if (!link) {
    throw new ApiError(404, "Invalid or expired invitation token");
  }

  if (link.status === "accepted") {
    res.status(200).json({
      success: true,
      message: "Invitation has already been accepted",
      data: link,
    });
    return;
  }

  if (link.status === "revoked") {
    throw new ApiError(403, "This invitation was revoked by the student");
  }

  // Prevent student from accepting their own invitation as guardian
  if (link.student.toString() === guardianUserId) {
    throw new ApiError(400, "You cannot accept your own guardian invitation");
  }

  link.guardianUser = new mongoose.Types.ObjectId(guardianUserId);
  link.status = "accepted";
  link.acceptedAt = new Date();
  await link.save();

  const populated = await GuardianAccess.findById(link._id).populate(
    "student",
    "name email"
  );

  res.status(200).json({
    success: true,
    message: "Guardian access granted successfully",
    data: populated,
  });
});

// GET MY GUARDIANS — Student
export const getMyGuardians = asyncHandler(async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const studentId = authReq.userId;

  if (!studentId) {
    throw new ApiError(401, "Authentication required");
  }

  const guardians = await GuardianAccess.find({ student: studentId })
    .populate("guardianUser", "name email")
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: guardians.length,
    data: guardians,
  });
});

// UPDATE GUARDIAN PERMISSIONS — Student
export const updateGuardianPermissions = asyncHandler(
  async (req, res: Response) => {
    const authReq = req as AuthRequest;
    const studentId = authReq.userId;
    const linkId = typeof req.params.id === "string" ? req.params.id : "";

    if (!studentId) {
      throw new ApiError(401, "Authentication required");
    }

    if (!mongoose.Types.ObjectId.isValid(linkId)) {
      throw new ApiError(400, "Invalid link ID");
    }

    const link = await GuardianAccess.findOne({
      _id: linkId,
      student: studentId,
    });

    if (!link) {
      throw new ApiError(404, "Guardian link not found");
    }

    const { permissions } = req.body as UpdateGuardianPermissionsInput;
    link.permissions = { ...link.permissions, ...permissions };
    await link.save();

    res.status(200).json({
      success: true,
      message: "Guardian permissions updated successfully",
      data: link,
    });
  }
);

// REVOKE GUARDIAN ACCESS — Student
export const revokeGuardianAccess = asyncHandler(async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const studentId = authReq.userId;
  const linkId = typeof req.params.id === "string" ? req.params.id : "";

  if (!studentId) {
    throw new ApiError(401, "Authentication required");
  }

  if (!mongoose.Types.ObjectId.isValid(linkId)) {
    throw new ApiError(400, "Invalid link ID");
  }

  const link = await GuardianAccess.findOne({
    _id: linkId,
    student: studentId,
  });

  if (!link) {
    throw new ApiError(404, "Guardian link not found");
  }

  link.status = "revoked";
  link.revokedAt = new Date();
  await link.save();

  res.status(200).json({
    success: true,
    message: "Guardian access revoked successfully",
    data: link,
  });
});

// GET GUARDIAN'S LINKED STUDENTS — Guardian User
export const getGuardianStudents = asyncHandler(async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const guardianUserId = authReq.userId;

  if (!guardianUserId) {
    throw new ApiError(401, "Authentication required");
  }

  const activeLinks = await GuardianAccess.find({
    guardianUser: guardianUserId,
    status: "accepted",
  })
    .populate("student", "name email")
    .sort({ acceptedAt: -1 });

  const students = activeLinks.map((link) => ({
    linkId: link._id,
    relationship: link.relationship,
    student: link.student,
    permissions: link.permissions,
    acceptedAt: link.acceptedAt,
  }));

  res.status(200).json({
    success: true,
    count: students.length,
    data: students,
  });
});

// GET PERMITTED STUDENT PROGRESS — Guardian User
// Strictly filters out private messages, passwords, billing, and sensitive personal information
export const getStudentProgressForGuardian = asyncHandler(
  async (req, res: Response) => {
    const authReq = req as AuthRequest;
    const guardianUserId = authReq.userId;
    const studentId =
      typeof req.params.studentId === "string" ? req.params.studentId : "";

    if (!guardianUserId) {
      throw new ApiError(401, "Authentication required");
    }

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      throw new ApiError(400, "Invalid student ID");
    }

    // Verify active, accepted guardian access
    const link = await GuardianAccess.findOne({
      guardianUser: guardianUserId,
      student: studentId,
      status: "accepted",
    });

    if (!link) {
      throw new ApiError(
        403,
        "You do not have active guardian authorization to view this student's progress"
      );
    }

    const studentUser = await User.findById(studentId).select("name email");
    if (!studentUser) {
      throw new ApiError(404, "Student not found");
    }

    const { permissions } = link;
    const progressReport: Record<string, any> = {
      student: {
        id: studentUser._id,
        name: studentUser.name,
      },
      relationship: link.relationship,
      permissions: link.permissions,
    };

    // 1. Enrolled Courses & Progress (if permitted)
    if (permissions.viewCourses || permissions.viewProgress) {
      const enrollments = await Enrollment.find({
        student: studentId,
        status: "active",
      })
        .populate("course", "title category level thumbnail")
        .lean();

      const coursesData = [];

      for (const en of enrollments) {
        const c = en.course as any;
        if (!c) continue;

        const totalPublishedLessons = await Lesson.countDocuments({
          course: c._id,
          isPublished: true,
        });

        const progress = await Progress.findOne({
          course: c._id,
          student: studentId,
        });

        const completedCount = progress?.completedLessons?.length || 0;
        const percentage =
          totalPublishedLessons > 0
            ? Math.round((completedCount / totalPublishedLessons) * 100)
            : 0;

        coursesData.push({
          courseId: c._id,
          title: c.title,
          category: c.category,
          level: c.level,
          thumbnail: c.thumbnail,
          enrolledAt: en.enrolledAt,
          ...(permissions.viewProgress
            ? {
                progress: {
                  completedLessons: completedCount,
                  totalLessons: totalPublishedLessons,
                  percentage,
                  lastAccessedAt: progress?.lastAccessedAt,
                },
              }
            : {}),
        });
      }

      progressReport.courses = coursesData;
    }

    // 2. Certificates (if permitted)
    if (permissions.viewCertificates) {
      const certificates = await Certificate.find({
        student: studentId,
        status: { $in: ["active", "renewed"] },
      })
        .select("verificationId metadata issuedAt expiresAt status")
        .sort({ issuedAt: -1 })
        .lean();

      progressReport.certificates = certificates;
    }

    // 3. Learning Time & Attendance (if permitted)
    if (permissions.viewAttendanceTime) {
      const timeStats = await LearningSession.aggregate([
        {
          $match: {
            student: new mongoose.Types.ObjectId(studentId),
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

      const totalActiveSeconds = timeStats[0]?.totalSeconds || 0;
      progressReport.attendanceTime = {
        totalHours: Math.round((totalActiveSeconds / 3600) * 10) / 10,
        totalSessions: timeStats[0]?.sessionCount || 0,
      };
    }

    res.status(200).json({
      success: true,
      message: "Student progress retrieved successfully",
      data: progressReport,
    });
  }
);

