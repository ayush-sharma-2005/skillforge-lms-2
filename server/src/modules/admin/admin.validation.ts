import { z } from "zod";

export const adminUserQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(100).default(10),

  role: z.enum(["student", "instructor", "admin"]).optional(),

  search: z.string().trim().max(100).optional(),
});

export const updateUserStatusSchema = z.object({
  isActive: z.boolean({
    error: "isActive must be a boolean",
  }),
});

export type AdminUserQueryInput = z.infer<
  typeof adminUserQuerySchema
>;

export type UpdateUserStatusInput = z.infer<
  typeof updateUserStatusSchema
>;