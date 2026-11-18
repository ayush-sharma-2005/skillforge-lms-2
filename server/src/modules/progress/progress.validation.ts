import { z } from "zod";

export const completeLessonSchema = z.object({
params: z.object({
courseId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid course ID"),
lessonId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid lesson ID"),
}),
});

export const courseProgressSchema = z.object({
params: z.object({
courseId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid course ID"),
}),
});
