import { z } from "zod";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const assignPeerReviewsSchema = z.object({
  assignmentId: z
    .string()
    .regex(objectIdRegex, "Invalid assignment ID format"),
  deadline: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "Invalid date format for deadline",
    })
    .optional(),
});

export const addCodeCommentSchema = z.object({
  line: z.number().int().min(1, "Line number must be a positive integer"),
  comment: z
    .string()
    .min(1, "Comment cannot be empty")
    .max(1000, "Comment cannot exceed 1000 characters"),
});

export const submitPeerReviewSchema = z.object({
  score: z.number().min(0).max(100).optional(),
  feedback: z.string().min(5, "Feedback must be at least 5 characters"),
  codeComments: z
    .array(
      z.object({
        line: z.number().int().min(1),
        comment: z.string().min(1).max(1000),
      })
    )
    .optional(),
});

export type AssignPeerReviewsInput = z.infer<typeof assignPeerReviewsSchema>;
export type AddCodeCommentInput = z.infer<typeof addCodeCommentSchema>;
export type SubmitPeerReviewInput = z.infer<typeof submitPeerReviewSchema>;

