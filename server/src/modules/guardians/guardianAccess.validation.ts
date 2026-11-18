import { z } from "zod";

const permissionsSchema = z.object({
  viewCourses: z.boolean().optional(),
  viewProgress: z.boolean().optional(),
  viewCertificates: z.boolean().optional(),
  viewAttendanceTime: z.boolean().optional(),
});

export const inviteGuardianSchema = z.object({
  guardianEmail: z.string().email("Invalid guardian email address"),
  relationship: z
    .enum(["parent", "guardian", "sponsor", "mentor"])
    .default("parent"),
  permissions: permissionsSchema.optional(),
});

export const updateGuardianPermissionsSchema = z.object({
  permissions: z.object({
    viewCourses: z.boolean().optional(),
    viewProgress: z.boolean().optional(),
    viewCertificates: z.boolean().optional(),
    viewAttendanceTime: z.boolean().optional(),
  }),
});

export type InviteGuardianInput = z.infer<typeof inviteGuardianSchema>;
export type UpdateGuardianPermissionsInput = z.infer<
  typeof updateGuardianPermissionsSchema
>;

