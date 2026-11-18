import { Router } from "express";

import {
  createQuestion,
  replyToQuestion,
  getLessonDiscussions,
  updateDiscussion,
  deleteDiscussion,
  reportDiscussion,
  moderateDiscussion,
  getReportedDiscussions,
} from "./discussion.controller";

import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";

import {
  createDiscussionSchema,
  replyDiscussionSchema,
  updateDiscussionSchema,
  reportDiscussionSchema,
  moderateDiscussionSchema,
} from "./discussion.validation";

const router = Router();

router.use(authenticate);

// Specific routes
router.get("/courses/:courseId/flagged", getReportedDiscussions);

// Lesson discussion routes
router.get("/lessons/:lessonId", getLessonDiscussions);
router.post(
  "/lessons/:lessonId",
  validate(createDiscussionSchema),
  createQuestion
);

// Individual discussion operations
router.post(
  "/:discussionId/reply",
  validate(replyDiscussionSchema),
  replyToQuestion
);

router.patch(
  "/:discussionId",
  validate(updateDiscussionSchema),
  updateDiscussion
);

router.delete("/:discussionId", deleteDiscussion);

router.post(
  "/:discussionId/report",
  validate(reportDiscussionSchema),
  reportDiscussion
);

router.patch(
  "/:discussionId/moderate",
  validate(moderateDiscussionSchema),
  moderateDiscussion
);

export default router;

