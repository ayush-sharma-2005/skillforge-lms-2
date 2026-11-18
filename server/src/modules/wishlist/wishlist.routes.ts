import { Router } from "express";

import {
  authenticate,
  authorize,
} from "../../middlewares/auth.middleware";

import {
  addToWishlist,
  getMyWishlist,
  removeFromWishlist,
} from "./wishlist.controller";

const router = Router();

// Add course to wishlist
router.post(
  "/:courseId",
  authenticate,
  authorize("student"),
  addToWishlist
);

// Get logged-in student's wishlist
router.get(
  "/",
  authenticate,
  authorize("student"),
  getMyWishlist
);

// Remove course from wishlist
router.delete(
  "/:courseId",
  authenticate,
  authorize("student"),
  removeFromWishlist
);

export default router;