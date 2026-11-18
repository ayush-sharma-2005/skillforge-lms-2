import { z } from "zod";

export const enrollCourseSchema = z.object({
params: z.object({
courseId: z
.string()
.regex(/^[a-fA-F0-9]{24}$/, "Invalid course ID"),
}),
});

export type EnrollCourseInput = z.infer<typeof enrollCourseSchema>;
