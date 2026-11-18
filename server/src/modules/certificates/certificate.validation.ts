import { z } from "zod";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const issueCertificateSchema = z.object({
  courseId: z
    .string()
    .regex(objectIdRegex, "Invalid course ID format"),
  validityMonths: z.number().int().min(0).max(120).default(12),
});

export const renewCertificateSchema = z.object({
  additionalMonths: z.number().int().min(1).max(120).default(12),
  notes: z.string().optional(),
});

export const revokeCertificateSchema = z.object({
  reason: z.string().min(3, "Reason must be at least 3 characters"),
});

export type IssueCertificateInput = z.infer<typeof issueCertificateSchema>;
export type RenewCertificateInput = z.infer<typeof renewCertificateSchema>;
export type RevokeCertificateInput = z.infer<typeof revokeCertificateSchema>;

