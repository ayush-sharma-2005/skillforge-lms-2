import { Router } from "express";
import {
  authenticate,
  authorize,
} from "../../middlewares/auth.middleware";

import {
  createReview,
  getCourseReviews,
  updateReview,
  deleteReview,
} from "./review.controller";

const router = Router();

router.post(
  "/:courseId",
  authenticate,
  authorize("student"),
  createReview
);

router.patch(
  "/:reviewId",
  authenticate,
  authorize("student"),
  updateReview
);

router.get("/:courseId", getCourseReviews);

router.delete(
  "/:reviewId",
  authenticate,
  authorize("student"),
  deleteReview
);

export default router;