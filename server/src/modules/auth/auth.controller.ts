import type { Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";

import { User } from "./auth.model";

import type {
  RegisterInput,
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from "./auth.validation";

import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import type { AuthRequest } from "../../middlewares/auth.middleware";

const COOKIE_NAME = "sf_token";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const RESET_TOKEN_EXPIRY = 15 * 60 * 1000;

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return secret;
};

const setAuthCookie = (res: Response, userId: string): void => {
  const token = jwt.sign(
    { sub: userId },
    getJwtSecret(),
    { expiresIn: "7d" }
  );

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
};

// REGISTER
export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body as RegisterInput;

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw new ApiError(409, "Email is already registered");
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await User.create({
    name,
    email,
    password: hashedPassword,
  });

  setAuthCookie(res, user.id);

  res.status(201).json({
    success: true,
    message: "Registration successful",
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    },
  });
});

// LOGIN
// LOGIN
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body as LoginInput;

  const user = await User.findOne({ email }).select("+password");

  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new ApiError(401, "Invalid email or password");
  }

  // Check whether account is active
  if (!user.isActive) {
    throw new ApiError(
      403,
      "Your account has been deactivated. Please contact administrator."
    );
  }

  setAuthCookie(res, user.id);

  res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    },
  });
});

// LOGOUT
export const logout = asyncHandler(async (_req, res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  res.status(200).json({
    success: true,
    message: "Logout successful",
  });
});

// GET CURRENT USER
export const getCurrentUser = asyncHandler(async (req, res) => {
  const authReq = req as AuthRequest;

  const user = await User.findById(authReq.userId).select(
    "name email role isEmailVerified createdAt"
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
      },
    },
  });
});

// FORGOT PASSWORD
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body as ForgotPasswordInput;

  const user = await User.findOne({ email });

  // Account existence is not disclosed in the API response.
  if (!user) {
    res.status(200).json({
      success: true,
      message:
        "If the account exists, password reset instructions will be sent.",
    });

    return;
  }

  // Generate a new random token.
  const resetToken = crypto.randomBytes(32).toString("hex");

  // Store only the SHA-256 hash in MongoDB.
  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  user.set("passwordResetToken", hashedToken);
  user.set(
    "passwordResetExpires",
    new Date(Date.now() + RESET_TOKEN_EXPIRY)
  );

  await user.save({ validateBeforeSave: false });

  // Development only: show the raw token in the server terminal.
  if (process.env.NODE_ENV !== "production") {
    console.log("\n==================================");
    console.log("PASSWORD RESET TOKEN");
    console.log(`Email: ${email}`);
    console.log(`Token: ${resetToken}`);
    console.log("Expires in: 15 minutes");
    console.log("==================================\n");
  }

  res.status(200).json({
    success: true,
    message:
      "If the account exists, password reset instructions will be sent.",
  });
});

// RESET PASSWORD
export const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body as ResetPasswordInput;

  // Reject an empty token.
  const rawToken = token.trim();

  if (!rawToken) {
    throw new ApiError(400, "Reset token is required");
  }

  // Hash the raw token to match the hash stored in MongoDB.
  const hashedToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: new Date() },
  }).select("+passwordResetToken +passwordResetExpires +password");

  if (!user) {
    throw new ApiError(
      400,
      "Reset token is invalid or expired. Request a new token."
    );
  }

  // Update the password.
  user.password = await bcrypt.hash(newPassword, 12);

  // Invalidate the reset token after successful use.
  user.set("passwordResetToken", undefined);
  user.set("passwordResetExpires", undefined);

  await user.save();

  // Clear any existing authentication cookie.
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  res.status(200).json({
    success: true,
    message: "Password reset successful. Please log in again.",
  });
});