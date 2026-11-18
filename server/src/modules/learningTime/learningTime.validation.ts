import { z } from "zod";

const objectIdRegex = /^[a-fA-F0-9]{24}$/;

export const heartbeatSchema = z.object({
  courseId: z.string().regex(objectIdRegex, "Invalid course ID"),
  lessonId: z.string().regex(objectIdRegex, "Invalid lesson ID"),
  durationSeconds: z.coerce.number().int().min(1).max(120), // Max 120s per ping prevents idle time!
});

export const timeAnalyticsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export type HeartbeatInput = z.infer<typeof heartbeatSchema>;
export type TimeAnalyticsQueryInput = z.infer<typeof timeAnalyticsQuerySchema>;

