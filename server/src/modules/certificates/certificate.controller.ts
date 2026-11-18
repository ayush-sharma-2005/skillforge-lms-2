import type { Request, Response } from "express";
import crypto from "node:crypto";
import mongoose from "mongoose";

import { Certificate } from "./certificate.model";
import { Course } from "../courses/course.model";
import Lesson from "../lessons/lesson.model";
import Progress from "../progress/progress.model";
import { User } from "../auth/auth.model";

import {
  type IssueCertificateInput,
  type RenewCertificateInput,
  type RevokeCertificateInput,
} from "./certificate.validation";

import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import type { AuthRequest } from "../../middlewares/auth.middleware";

function generateVerificationId(): string {
  const prefix = "SKILL";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

// ISSUE CERTIFICATE — Student (on course completion), Instructor, or Admin
export const issueCertificate = asyncHandler(async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const currentUserId = authReq.userId;

  if (!currentUserId) {
    throw new ApiError(401, "Authentication required");
  }

  const { courseId, validityMonths = 12 } = req.body as IssueCertificateInput;

  const course = await Course.findById(courseId).populate(
    "instructor",
    "name email"
  );
  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  const studentUser = await User.findById(currentUserId);
  if (!studentUser) {
    throw new ApiError(404, "Student record not found");
  }

  // 1. Verify 100% Course Completion
  const publishedLessons = await Lesson.find({
    course: courseId,
    isPublished: true,
  }).select("_id");

  if (publishedLessons.length === 0) {
    throw new ApiError(
      400,
      "Cannot issue certificate for course with no published lessons"
    );
  }

  const progress = await Progress.findOne({
    course: courseId,
    student: currentUserId,
  });

  const completedLessonIdStrings = new Set(
    (progress?.completedLessons || []).map((id) => id.toString())
  );

  const allCompleted = publishedLessons.every((l) =>
    completedLessonIdStrings.has(l._id.toString())
  );

  if (!allCompleted) {
    throw new ApiError(
      403,
      "Course requirements incomplete. You must complete 100% of lessons to receive a certificate"
    );
  }

  // 2. Check existing active certificate
  const existingCert = await Certificate.findOne({
    student: currentUserId,
    course: courseId,
    status: { $in: ["active", "renewed"] },
  });

  if (existingCert) {
    // If not expired, return existing
    if (!existingCert.expiresAt || new Date() < new Date(existingCert.expiresAt)) {
      res.status(200).json({
        success: true,
        message: "Active certificate already issued for this course",
        data: existingCert,
      });
      return;
    }
    // Mark as expired to allow re-issuance or renewal
    existingCert.status = "expired";
    await existingCert.save();
  }

  // 3. Generate verification ID and expiry date
  const verificationId = generateVerificationId();
  const issuedAt = new Date();
  const expiresAt =
    validityMonths > 0
      ? new Date(issuedAt.getTime() + validityMonths * 30 * 24 * 60 * 60 * 1000)
      : undefined;

  const instructorName =
    (course.instructor as any)?.name || "Certified SkillForge Instructor";

  const certificate = await Certificate.create({
    verificationId,
    student: currentUserId,
    course: courseId,
    issuedAt,
    validityMonths,
    expiresAt,
    status: "active",
    renewalHistory: [],
    metadata: {
      studentName: studentUser.name,
      courseTitle: course.title,
      instructorName,
      completionDate: progress?.lastAccessedAt || issuedAt,
    },
  });

  res.status(201).json({
    success: true,
    message: "Certificate generated successfully",
    data: certificate,
  });
});

// PUBLIC CERTIFICATE VERIFICATION — Anyone (No Auth Required)
export const verifyCertificate = asyncHandler(
  async (req: Request, res: Response) => {
    const rawId = req.params.verificationId;
    const verificationId = typeof rawId === "string" ? rawId.trim().toUpperCase() : "";

    if (!verificationId) {
      throw new ApiError(400, "Verification ID is required");
    }

    const certificate = await Certificate.findOne({ verificationId })
      .populate("course", "title category level")
      .populate("student", "name");

    if (!certificate) {
      res.status(404).json({
        success: false,
        isValid: false,
        status: "not_found",
        message: "Certificate not found. The verification ID is invalid.",
      });
      return;
    }

    // Check Revocation
    if (certificate.status === "revoked") {
      res.status(200).json({
        success: true,
        isValid: false,
        status: "revoked",
        message: "This certificate was revoked by the issuing institution.",
        verificationId: certificate.verificationId,
        metadata: certificate.metadata,
        revokedAt: certificate.revokedAt,
        revocationReason: certificate.revocationReason,
      });
      return;
    }

    // Check Expiration
    if (certificate.expiresAt && new Date() > new Date(certificate.expiresAt)) {
      if (certificate.status !== "expired") {
        certificate.status = "expired";
        await certificate.save();
      }

      res.status(200).json({
        success: true,
        isValid: false,
        status: "expired",
        message: "This certificate has expired and is no longer valid.",
        verificationId: certificate.verificationId,
        metadata: certificate.metadata,
        issuedAt: certificate.issuedAt,
        expiredAt: certificate.expiresAt,
        renewalHistoryCount: certificate.renewalHistory.length,
      });
      return;
    }

    // Authentic and Active
    res.status(200).json({
      success: true,
      isValid: true,
      status: certificate.status,
      message: "Certificate is authentic, verified, and in good standing.",
      data: certificate,
    });
  }
);

// GET MY CERTIFICATES — Student
export const getMyCertificates = asyncHandler(async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;

  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

  const certificates = await Certificate.find({ student: userId })
    .populate("course", "title category level thumbnail")
    .sort({ issuedAt: -1 });

  // Update expired statuses in place
  const now = new Date();
  for (const cert of certificates) {
    if (
      cert.status !== "revoked" &&
      cert.status !== "expired" &&
      cert.expiresAt &&
      now > new Date(cert.expiresAt)
    ) {
      cert.status = "expired";
      await cert.save();
    }
  }

  res.status(200).json({
    success: true,
    count: certificates.length,
    data: certificates,
  });
});

// GET CERTIFICATE FOR A SPECIFIC COURSE — Student or Instructor
export const getCourseCertificate = asyncHandler(async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;
  const courseId =
    typeof req.params.courseId === "string" ? req.params.courseId : "";

  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    throw new ApiError(400, "Invalid course ID");
  }

  const certificate = await Certificate.findOne({
    course: courseId,
    student: userId,
  }).populate("course", "title category level");

  if (!certificate) {
    throw new ApiError(404, "No certificate found for this course");
  }

  // Update expiration status
  if (
    certificate.status !== "revoked" &&
    certificate.status !== "expired" &&
    certificate.expiresAt &&
    new Date() > new Date(certificate.expiresAt)
  ) {
    certificate.status = "expired";
    await certificate.save();
  }

  res.status(200).json({
    success: true,
    data: certificate,
  });
});

// RENEW CERTIFICATE — Instructor, Admin, or Student Refresher Workflow
export const renewCertificate = asyncHandler(async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;
  const certId = typeof req.params.id === "string" ? req.params.id : "";

  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

  if (!mongoose.Types.ObjectId.isValid(certId)) {
    throw new ApiError(400, "Invalid certificate ID");
  }

  const certificate = await Certificate.findById(certId).populate("course");
  if (!certificate) {
    throw new ApiError(404, "Certificate not found");
  }

  const course = certificate.course as any;
  const isInstructor = course?.instructor?.toString() === userId;
  const isAdmin = authReq.userRole === "admin";
  const isStudentOwner = certificate.student.toString() === userId;

  if (!isInstructor && !isAdmin && !isStudentOwner) {
    throw new ApiError(403, "Access denied to renew this certificate");
  }

  const { additionalMonths = 12, notes } = req.body as RenewCertificateInput;

  if (certificate.status === "revoked") {
    throw new ApiError(400, "Cannot renew a revoked certificate");
  }

  const previousExpiresAt = certificate.expiresAt;
  const baseTime =
    certificate.expiresAt && new Date(certificate.expiresAt) > new Date()
      ? new Date(certificate.expiresAt).getTime()
      : Date.now();

  const newExpiresAt = new Date(
    baseTime + additionalMonths * 30 * 24 * 60 * 60 * 1000
  );

  certificate.renewalHistory.push({
    renewedAt: new Date(),
    previousExpiresAt,
    newExpiresAt,
    renewedBy: new mongoose.Types.ObjectId(userId),
    notes: notes || "Certificate renewed with updated validity period",
  });

  certificate.expiresAt = newExpiresAt;
  certificate.validityMonths = certificate.validityMonths + additionalMonths;
  certificate.status = "renewed";

  await certificate.save();

  res.status(200).json({
    success: true,
    message: `Certificate renewed successfully until ${newExpiresAt.toISOString()}`,
    data: certificate,
  });
});

// REVOKE CERTIFICATE — Instructor or Admin
export const revokeCertificate = asyncHandler(async (req, res: Response) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;
  const certId = typeof req.params.id === "string" ? req.params.id : "";

  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

  if (!mongoose.Types.ObjectId.isValid(certId)) {
    throw new ApiError(400, "Invalid certificate ID");
  }

  const certificate = await Certificate.findById(certId).populate("course");
  if (!certificate) {
    throw new ApiError(404, "Certificate not found");
  }

  const course = certificate.course as any;
  const isInstructor = course?.instructor?.toString() === userId;
  const isAdmin = authReq.userRole === "admin";

  if (!isInstructor && !isAdmin) {
    throw new ApiError(403, "Only the course instructor or admin can revoke a certificate");
  }

  const { reason } = req.body as RevokeCertificateInput;

  certificate.status = "revoked";
  certificate.revokedAt = new Date();
  certificate.revocationReason = reason;

  await certificate.save();

  res.status(200).json({
    success: true,
    message: "Certificate has been revoked",
    data: certificate,
  });
});

