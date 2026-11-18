import { z } from "zod";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const rubricItemSchema = z.object({
  criterion: z.string().min(2, "Criterion must be at least 2 characters"),
  maxPoints: z.number().min(1, "Max points must be at least 1"),
  description: z.string().optional(),
});

export const createAssignmentSchema = z.object({
  courseId: z
    .string()
    .regex(objectIdRegex, "Invalid course ID format"),
  lessonId: z
    .string()
    .regex(objectIdRegex, "Invalid lesson ID format")
    .optional(),
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title cannot exceed 200 characters"),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters"),
  assignmentType: z.enum(["text", "code"]).default("text"),
  allowedLanguages: z.array(z.string().trim().toLowerCase()).optional(),
  dueDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "Invalid date format for dueDate",
    }),
  maxScore: z.number().min(1).default(100),
  rubrics: z.array(rubricItemSchema).optional().default([]),
  similarityThreshold: z.number().min(0).max(100).default(40),
  isPeerReviewEnabled: z.boolean().default(false),
  peerReviewsPerSubmission: z.number().min(1).max(5).default(2),
  peerReviewDeadline: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "Invalid date format for peerReviewDeadline",
    })
    .optional(),
  aiEvaluationEnabled: z.boolean().default(true),
  isPublished: z.boolean().default(true),
});

export const updateAssignmentSchema = createAssignmentSchema.partial().omit({
  courseId: true,
});

export const submitAssignmentSchema = z.object({
  content: z
    .string()
    .min(10, "Submission content must be at least 10 characters"),
  language: z.string().trim().toLowerCase().optional(),
});

export const gradeSubmissionSchema = z.object({
  score: z.number().min(0, "Score cannot be negative").optional(),
  feedback: z.string().min(2, "Feedback must be at least 2 characters").optional(),
  rubricScores: z
    .array(
      z.object({
        criterion: z.string(),
        score: z.number().min(0),
        feedback: z.string().optional(),
      })
    )
    .optional(),
  useAiScore: z.boolean().optional(),
});

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;
export type SubmitAssignmentInput = z.infer<typeof submitAssignmentSchema>;
export type GradeSubmissionInput = z.infer<typeof gradeSubmissionSchema>;

