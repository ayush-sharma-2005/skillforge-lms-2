import { Router } from "express";

import {
  createResource,
  getCourseResources,
  updateResource,
  deleteResource,
  generateDownloadToken,
  downloadResourceWithToken,
  getResourceAnalytics,
} from "./resource.controller";

import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  createResourceSchema,
  updateResourceSchema,
} from "./resource.validation";

const router = Router();

// Public download verification route (token-gated)
router.get("/download/:token", downloadResourceWithToken);

// Protected routes below
router.use(authenticate);

// Course resources & analytics
router.get("/course/:courseId", getCourseResources);
router.get(
  "/course/:courseId/analytics",
  authorize("instructor", "admin"),
  getResourceAnalytics
);

// Resource CRUD
router.post(
  "/",
  authorize("instructor", "admin"),
  validate(createResourceSchema),
  createResource
);

router.patch(
  "/:resourceId",
  authorize("instructor", "admin"),
  validate(updateResourceSchema),
  updateResource
);

router.delete(
  "/:resourceId",
  authorize("instructor", "admin"),
  deleteResource
);

// Generate time-limited signed download token
router.post("/:resourceId/download-token", generateDownloadToken);

export default router;

