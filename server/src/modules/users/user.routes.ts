import { Router } from "express";

import {
  getProfile,
  updateProfile,
  changePassword,
} from "./user.controller";

import {
  updateProfileSchema,
  changePasswordSchema,
} from "./user.validation";

import { authenticate } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";

const router = Router();

router.use(authenticate);

router.get("/profile", getProfile);

router.patch(
  "/profile",
  validate(updateProfileSchema),
  updateProfile
);

router.patch(
  "/change-password",
  validate(changePasswordSchema),
  changePassword
);

export default router;