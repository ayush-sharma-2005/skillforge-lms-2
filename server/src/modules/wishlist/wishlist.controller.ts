import mongoose from "mongoose";
import { Response, NextFunction } from "express";

import Wishlist from "./wishlist.model";
import { Course } from "../courses/course.model";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { ApiError } from "../../utils/ApiError";

export const addToWishlist = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const studentId = req.userId;
    const courseId = req.params.courseId;

    if (!studentId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    if (
      typeof courseId !== "string" ||
      !mongoose.isValidObjectId(courseId)
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid course ID",
      });
      return;
    }

    const course = await Course.findOne({
      _id: courseId,
      isPublished: true,
    });

    if (!course) {
      res.status(404).json({
        success: false,
        message: "Published course not found",
      });
      return;
    }

    const existingItem = await Wishlist.findOne({
      student: studentId,
      course: course._id,
    });

    if (existingItem) {
      res.status(409).json({
        success: false,
        message: "Course is already in your wishlist",
      });
      return;
    }

    const wishlistItem = await Wishlist.create({
      student: studentId,
      course: course._id,
    });

    res.status(201).json({
      success: true,
      message: "Course added to wishlist successfully",
      data: { wishlistItem },
    });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      next(new ApiError(409, "Course is already in your wishlist"));
      return;
    }

    next(error);
  }
};

export const getMyWishlist = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const studentId = req.userId;

    if (!studentId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const wishlist = await Wishlist.find({
      student: studentId,
    })
      .populate({
        path: "course",
        match: { isPublished: true },
        populate: {
          path: "instructor",
          select: "name",
        },
      })
      .sort({ createdAt: -1 })
      .lean();

    const courses = wishlist
      .filter((item) => item.course !== null)
      .map((item) => item.course);

    res.status(200).json({
      success: true,
      message: "Wishlist fetched successfully",
      data: {
        total: courses.length,
        courses,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const removeFromWishlist = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const studentId = req.userId;
    const courseId = req.params.courseId;

    if (!studentId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    if (
      typeof courseId !== "string" ||
      !mongoose.isValidObjectId(courseId)
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid course ID",
      });
      return;
    }

    const result = await Wishlist.deleteOne({
      student: studentId,
      course: courseId,
    });

    if (result.deletedCount === 0) {
      res.status(404).json({
        success: false,
        message: "Course not found in your wishlist",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Course removed from wishlist successfully",
    });
  } catch (error) {
    next(error);
  }
};