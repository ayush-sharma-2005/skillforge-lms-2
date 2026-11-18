import { z } from "zod";

const objectIdRegex = /^[a-fA-F0-9]{24}$/;

export const createResourceSchema = z.object({
  courseId: z.string().regex(objectIdRegex, "Invalid course ID"),
  lessonId: z.string().regex(objectIdRegex, "Invalid lesson ID").optional(),
  title: z.string().trim().min(2).max(150),
  description: z.string().trim().max(500).optional(),
  fileUrl: z.string().trim().url(),
  fileSize: z.coerce.number().min(0).default(0),
  fileType: z.string().trim().min(2).max(20).default("pdf"),
  isDownloadable: z.boolean().default(true),
});

export const updateResourceSchema = createResourceSchema
  .omit({ courseId: true })
  .partial();

export type CreateResourceInput = z.infer<typeof createResourceSchema>;
export type UpdateResourceInput = z.infer<typeof updateResourceSchema>;

