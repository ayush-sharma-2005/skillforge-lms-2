import type { Response } from "express";
import bcrypt from "bcryptjs";
import { User } from "../auth/auth.model";
import { ApiError } from "../../utils/ApiError";
import { asyncHandler } from "../../utils/asyncHandler";
import type { AuthRequest } from "../../middlewares/auth.middleware";
import type { UpdateProfileInput } from "./user.validation";

// GET CURRENT USER PROFILE
export const getProfile = asyncHandler(async (req, res) => {
  const authReq = req as AuthRequest;

  const user = await User.findById(authReq.userId).select(
    "name email role isEmailVerified createdAt updatedAt"
  );

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.get("createdAt"),
        updatedAt: user.get("updatedAt"),
      },
    },
  });
});

// UPDATE CURRENT USER PROFILE
export const updateProfile = asyncHandler(async (req, res) => {
  const authReq = req as AuthRequest;
  const { name } = req.body as UpdateProfileInput;

  if (!name) {
    throw new ApiError(400, "At least one profile field is required");
  }

  const user = await User.findByIdAndUpdate(
    authReq.userId,
    { $set: { name } },
    {
      new: true,
      runValidators: true,
    }
  ).select("name email role isEmailVerified createdAt updatedAt");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.get("createdAt"),
        updatedAt: user.get("updatedAt"),
      },
    },
  });
});

export const changePassword = asyncHandler(async (req, res) => {
  const authReq = req as AuthRequest;

  const { currentPassword, newPassword } =
    req.body as import("./user.validation").ChangePasswordInput;

  const user = await User.findById(authReq.userId).select("+password");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isPasswordValid = await bcrypt.compare(
    currentPassword,
    user.password
  );

  if (!isPasswordValid) {
    throw new ApiError(400, "Current password is incorrect");
  }

  const isSamePassword = await bcrypt.compare(
    newPassword,
    user.password
  );

  if (isSamePassword) {
    throw new ApiError(
      400,
      "New password must be different from current password"
    );
  }

  user.password = await bcrypt.hash(newPassword, 12);
  await user.save();

  res.status(200).json({
    success: true,
    message: "Password changed successfully. Please log in again."
  });
});

