import { z } from "zod";

const stringArraySchema = z.array(z.string().trim().min(1)).max(30);

export const courseTranslationSchema = z.object({
  language: z.string().trim().min(2).max(10),
  title: z.string().trim().min(2).max(150),
  description: z.string().trim().min(5),
  shortDescription: z.string().trim().max(300).optional(),
});

export const createCourseSchema = z.object({
  title: z.string().trim().min(5).max(150),
  description: z.string().trim().min(20),
  shortDescription: z.string().trim().min(5).max(300),
  thumbnail: z.string().trim().url().optional(),
  price: z.coerce.number().min(0).default(0),
  category: z.string().trim().min(2).max(80),
  level: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
  language: z.string().trim().min(2).max(50).default("en"),
  supportedLanguages: z.array(z.string().trim().min(2).max(10)).default(["en"]),
  translations: z.array(courseTranslationSchema).default([]),
  requirements: stringArraySchema.default([]),
  learningOutcomes: stringArraySchema.default([]),
  prerequisites: z
    .array(z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid prerequisite course ID"))
    .default([]),
});

export const updateCourseSchema = createCourseSchema.partial();

export const courseQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  category: z.string().trim().optional(),
  level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  lang: z.string().trim().optional(),
  sort: z.enum(["newest", "oldest", "price-low", "price-high"]).default("newest"),
});

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
export type CourseQueryInput = z.infer<typeof courseQuerySchema>;
export type CourseTranslationInput = z.infer<typeof courseTranslationSchema>;
