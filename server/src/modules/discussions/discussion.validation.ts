import { z } from "zod";

export const createDiscussionSchema = z.object({
  content: z.string().trim().min(2).max(2000),
});

export const replyDiscussionSchema = z.object({
  content: z.string().trim().min(2).max(2000),
});

export const updateDiscussionSchema = z.object({
  content: z.string().trim().min(2).max(2000),
});

export const reportDiscussionSchema = z.object({
  reason: z.string().trim().min(3).max(300),
});

export const moderateDiscussionSchema = z.object({
  status: z.enum(["active", "flagged", "hidden"]).optional(),
  isPinned: z.boolean().optional(),
});

export const discussionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateDiscussionInput = z.infer<typeof createDiscussionSchema>;
export type ReplyDiscussionInput = z.infer<typeof replyDiscussionSchema>;
export type UpdateDiscussionInput = z.infer<typeof updateDiscussionSchema>;
export type ReportDiscussionInput = z.infer<typeof reportDiscussionSchema>;
export type ModerateDiscussionInput = z.infer<typeof moderateDiscussionSchema>;
export type DiscussionQueryInput = z.infer<typeof discussionQuerySchema>;

