import mongoose, { Schema, type Document } from "mongoose";

export interface IRubricItem {
  id?: string;
  criterion: string;
  maxPoints: number;
  description?: string;
}

export interface IAssignment extends Document {
  course: mongoose.Types.ObjectId;
  lesson?: mongoose.Types.ObjectId;
  instructor: mongoose.Types.ObjectId;
  title: string;
  description: string;
  assignmentType: "text" | "code";
  allowedLanguages?: string[];
  dueDate: Date;
  maxScore: number;
  rubrics: IRubricItem[];
  similarityThreshold: number;
  isPeerReviewEnabled: boolean;
  peerReviewsPerSubmission: number;
  peerReviewDeadline?: Date;
  aiEvaluationEnabled: boolean;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const rubricItemSchema = new Schema<IRubricItem>(
  {
    criterion: {
      type: String,
      required: true,
      trim: true,
    },
    maxPoints: {
      type: Number,
      required: true,
      min: 1,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  { _id: true }
);

const assignmentSchema = new Schema<IAssignment>(
  {
    course: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    lesson: {
      type: Schema.Types.ObjectId,
      ref: "Lesson",
    },
    instructor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    assignmentType: {
      type: String,
      enum: ["text", "code"],
      default: "text",
      required: true,
    },
    allowedLanguages: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    dueDate: {
      type: Date,
      required: true,
    },
    maxScore: {
      type: Number,
      default: 100,
      min: 1,
    },
    rubrics: {
      type: [rubricItemSchema],
      default: [],
    },
    similarityThreshold: {
      type: Number,
      default: 40,
      min: 0,
      max: 100,
    },
    isPeerReviewEnabled: {
      type: Boolean,
      default: false,
    },
    peerReviewsPerSubmission: {
      type: Number,
      default: 2,
      min: 1,
      max: 5,
    },
    peerReviewDeadline: {
      type: Date,
    },
    aiEvaluationEnabled: {
      type: Boolean,
      default: true,
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

assignmentSchema.index({ course: 1, isPublished: 1 });
assignmentSchema.index({ instructor: 1, createdAt: -1 });

export const Assignment = mongoose.model<IAssignment>(
  "Assignment",
  assignmentSchema
);

