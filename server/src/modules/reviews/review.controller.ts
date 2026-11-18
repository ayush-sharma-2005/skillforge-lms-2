import { Response, NextFunction } from "express";
import mongoose from "mongoose";

import Review from "./review.model";
import Enrollment from "../enrollments/enrollment.model";
import { Course } from "../courses/course.model";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { ApiError } from "../../utils/ApiError";

export const createReview = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const studentId = req.userId;
    const courseId = req.params.courseId;
    const { rating, comment } = req.body as {
      rating?: number;
      comment?: string;
    };

    // Check authentication
    if (!studentId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    // Validate course ID
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

    // Validate rating
    if (
      typeof rating !== "number" ||
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5
    ) {
      res.status(400).json({
        success: false,
        message: "Rating must be an integer between 1 and 5",
      });
      return;
    }

    // Validate comment
    if (
      typeof comment !== "string" ||
      comment.trim().length < 3 ||
      comment.trim().length > 1000
    ) {
      res.status(400).json({
        success: false,
        message: "Comment must be between 3 and 1000 characters",
      });
      return;
    }

    // Check whether the course exists and is published
    const course = await Course.findById(courseId);

    if (!course || !course.isPublished) {
      res.status(404).json({
        success: false,
        message: "Published course not found",
      });
      return;
    }

    // Verify active enrollment
    const enrollment = await Enrollment.findOne({
      student: studentId,
      course: course._id,
      status: "active",
    });

    if (!enrollment) {
      res.status(403).json({
        success: false,
        message: "You must be enrolled in this course to review it",
      });
      return;
    }

    // Prevent duplicate reviews
    const existingReview = await Review.findOne({
      student: studentId,
      course: course._id,
    });

    if (existingReview) {
      res.status(409).json({
        success: false,
        message: "You have already reviewed this course",
      });
      return;
    }

    // Create review
    const review = await Review.create({
      student: studentId,
      course: course._id,
      rating,
      comment: comment.trim(),
    });

    res.status(201).json({
      success: true,
      message: "Review created successfully",
      data: {
        review,
      },
    });
  } catch (error: unknown) {
    // Handle duplicate-key errors
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      res.status(409).json({
        success: false,
        message: "You have already reviewed this course",
      });
      return;
    }

    // Handle Mongoose validation errors
    if (error instanceof mongoose.Error.ValidationError) {
      next(new ApiError(400, error.message));
      return;
    }

    next(error);
  }
};

export const getCourseReviews = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const courseId = req.params.courseId;

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

    const course = await Course.findById(courseId);

    if (!course || !course.isPublished) {
      res.status(404).json({
        success: false,
        message: "Published course not found",
      });
      return;
    }

    const reviews = await Review.find({
      course: course._id,
    })
      .populate("student", "name")
      .sort({ createdAt: -1 });

    const totalReviews = reviews.length;

    const averageRating =
      totalReviews > 0
        ? Number(
            (
              reviews.reduce((sum, review) => sum + review.rating, 0) /
              totalReviews
            ).toFixed(1)
          )
        : 0;

    res.status(200).json({
      success: true,
      message: "Reviews fetched successfully",
      data: {
        totalReviews,
        averageRating,
        reviews,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateReview = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const studentId = req.userId;
    const reviewId = req.params.reviewId;
    const { rating, comment } = req.body as {
      rating?: number;
      comment?: string;
    };

    // Check authentication
    if (!studentId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    // Validate review ID
    if (
      typeof reviewId !== "string" ||
      !mongoose.isValidObjectId(reviewId)
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid review ID",
      });
      return;
    }

    // Require at least one field to update
    if (rating === undefined && comment === undefined) {
      res.status(400).json({
        success: false,
        message: "Provide rating or comment to update",
      });
      return;
    }

    // Validate rating if provided
    if (
      rating !== undefined &&
      (
        typeof rating !== "number" ||
        !Number.isInteger(rating) ||
        rating < 1 ||
        rating > 5
      )
    ) {
      res.status(400).json({
        success: false,
        message: "Rating must be an integer between 1 and 5",
      });
      return;
    }

    // Validate comment if provided
    if (
      comment !== undefined &&
      (
        typeof comment !== "string" ||
        comment.trim().length < 3 ||
        comment.trim().length > 1000
      )
    ) {
      res.status(400).json({
        success: false,
        message: "Comment must be between 3 and 1000 characters",
      });
      return;
    }

    // Find review belonging to the logged-in student
    const review = await Review.findOne({
      _id: reviewId,
      student: studentId,
    });

    if (!review) {
      res.status(404).json({
        success: false,
        message: "Review not found or you are not allowed to update it",
      });
      return;
    }

    // Update only the provided fields
    if (rating !== undefined) {
      review.rating = rating;
    }

    if (comment !== undefined) {
      review.comment = comment.trim();
    }

    await review.save();

    res.status(200).json({
      success: true,
      message: "Review updated successfully",
      data: {
        review,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteReview = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const studentId = req.userId;
    const reviewId = req.params.reviewId;

    if (!studentId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    if (
      typeof reviewId !== "string" ||
      !mongoose.isValidObjectId(reviewId)
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid review ID",
      });
      return;
    }

    const review = await Review.findOne({
      _id: reviewId,
      student: studentId,
    });

    if (!review) {
      res.status(404).json({
        success: false,
        message: "Review not found or you are not allowed to delete it",
      });
      return;
    }

    await Review.deleteOne({ _id: review._id });

    res.status(200).json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};