import { z } from "zod";

export const createCourseVersionSchema = z.object({
  version: z.string().trim().min(1).max(20),
  changelog: z.string().trim().min(3).max(2000),
});

export type CreateCourseVersionInput = z.infer<
  typeof createCourseVersionSchema
>;

