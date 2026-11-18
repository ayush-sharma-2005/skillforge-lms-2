import { Router } from "express";

import {
  issueCertificate,
  verifyCertificate,
  getMyCertificates,
  getCourseCertificate,
  renewCertificate,
  revokeCertificate,
} from "./certificate.controller";

import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";

import {
  issueCertificateSchema,
  renewCertificateSchema,
  revokeCertificateSchema,
} from "./certificate.validation";

const router = Router();

// 1. PUBLIC VERIFICATION (No Authentication Required)
router.get("/verify/:verificationId", verifyCertificate);

// Protected routes below
router.use(authenticate);

// 2. Student & Issuance routes
router.post(
  "/issue",
  authorize("student", "instructor", "admin"),
  validate(issueCertificateSchema),
  issueCertificate
);

router.get("/my-certificates", authorize("student"), getMyCertificates);

router.get("/course/:courseId", getCourseCertificate);

// 3. Renewal & Revocation routes
router.post(
  "/:id/renew",
  validate(renewCertificateSchema),
  renewCertificate
);

router.post(
  "/:id/revoke",
  authorize("instructor", "admin"),
  validate(revokeCertificateSchema),
  revokeCertificate
);

export default router;

