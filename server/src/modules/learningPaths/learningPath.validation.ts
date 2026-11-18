import { z } from "zod";

const objectIdRegex = /^[a-fA-F0-9]{24}$/;

export const learningPathCourseSchema = z.object({
  course: z.string().regex(objectIdRegex, "Invalid course ID"),
  order: z.coerce.number().int().min(1),
  prerequisites: z
    .array(z.string().regex(objectIdRegex, "Invalid prerequisite course ID"))
    .default([]),
});

export const createLearningPathSchema = z.object({
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().min(10),
  thumbnail: z.string().trim().url().optional(),
  category: z.string().trim().min(2).max(80),
  level: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
  courses: z.array(learningPathCourseSchema).default([]),
});

export const updateLearningPathSchema = createLearningPathSchema.partial();

export const learningPathQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  category: z.string().trim().optional(),
  level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  sort: z.enum(["newest", "oldest", "title"]).default("newest"),
});

export type CreateLearningPathInput = z.infer<typeof createLearningPathSchema>;
export type UpdateLearningPathInput = z.infer<typeof updateLearningPathSchema>;
export type LearningPathQueryInput = z.infer<typeof learningPathQuerySchema>;

