import { z } from "zod";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const codeRegex = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

export const createOrganizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Organization name must be at least 2 characters")
    .max(120, "Organization name cannot exceed 120 characters"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(slugRegex, "Slug must be lowercase alphanumeric and hyphens only"),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(codeRegex, "Code must be uppercase alphanumeric and hyphens only"),
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .optional(),
  description: z.string().trim().optional(),
  website: z.string().trim().url().optional(),
  adminEmail: z.string().trim().email().optional(),
  maxStudents: z.number().int().min(1).default(500),
});

export const updateOrganizationSchema = createOrganizationSchema.partial().omit({
  code: true,
});

export const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid member email"),
  role: z.enum(["student", "instructor", "org_admin"]).default("student"),
  name: z.string().trim().min(2).optional(),
});

export const assignCourseSchema = z.object({
  courseId: z
    .string()
    .regex(objectIdRegex, "Invalid course ID format"),
});

export const studentBatchItemSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(2).optional(),
});

export const bulkEnrollSchema = z.object({
  courseIds: z
    .array(z.string().regex(objectIdRegex, "Invalid course ID format"))
    .min(1, "At least one course ID must be provided"),
  students: z
    .array(studentBatchItemSchema)
    .min(1, "At least one student must be provided")
    .max(500, "Cannot process more than 500 students in a single batch"),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type AssignCourseInput = z.infer<typeof assignCourseSchema>;
export type BulkEnrollInput = z.infer<typeof bulkEnrollSchema>;
