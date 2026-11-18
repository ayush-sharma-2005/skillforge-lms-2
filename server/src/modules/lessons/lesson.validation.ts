import { z } from "zod";

export const lessonCaptionSchema = z.object({
  language: z.string().trim().min(2).max(10),
  label: z.string().trim().min(1).max(50),
  url: z.string().trim().url(),
  isDefault: z.boolean().default(false),
});

export const lessonAccessibilitySchema = z.object({
  estimatedReadingTimeMinutes: z.coerce.number().min(0).optional(),
  screenReaderNotes: z.string().trim().optional(),
  hasHighContrastSupport: z.boolean().default(true),
});

export const lessonTranslationSchema = z.object({
  language: z.string().trim().min(2).max(10),
  title: z.string().trim().min(2).max(150),
  description: z.string().trim().min(1),
  transcript: z.string().trim().optional(),
});

export const createLessonSchema = z.object({
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().min(1),
  videoUrl: z.string().url().optional(),
  duration: z.coerce.number().min(0),
  order: z.coerce.number().int().min(1),
  dripType: z.enum(["none", "date", "enrollment_days"]).default("none"),
  unlockDate: z.coerce.date().optional(),
  unlockAfterDays: z.coerce.number().int().min(0).optional(),
  transcript: z.string().trim().optional(),
  audioDescriptionUrl: z.string().trim().url().optional(),
  captions: z.array(lessonCaptionSchema).default([]),
  accessibility: lessonAccessibilitySchema.optional(),
  translations: z.array(lessonTranslationSchema).default([]),
});

export const updateLessonSchema = createLessonSchema.partial().extend({
  isPublished: z.boolean().optional(),
});

export type CreateLessonInput = z.infer<typeof createLessonSchema>;
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>;
export type LessonTranslationInput = z.infer<typeof lessonTranslationSchema>;
export type LessonCaptionInput = z.infer<typeof lessonCaptionSchema>;
