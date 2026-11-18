import mongoose, { Schema, type Document, Types } from "mongoose";

export interface ILearningPathCourse {
  course: Types.ObjectId;
  order: number;
  prerequisites: Types.ObjectId[];
}

export interface ILearningPath extends Document {
  title: string;
  description: string;
  thumbnail?: string;
  instructor: Types.ObjectId;
  category: string;
  level: "beginner" | "intermediate" | "advanced";
  courses: ILearningPathCourse[];
  enrolledStudents: Types.ObjectId[];
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const learningPathCourseSchema = new Schema<ILearningPathCourse>(
  {
    course: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    order: {
      type: Number,
      required: true,
      min: 1,
    },
    prerequisites: [
      {
        type: Schema.Types.ObjectId,
        ref: "Course",
      },
    ],
  },
  { _id: false }
);

const learningPathSchema = new Schema<ILearningPath>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 150,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
    },
    thumbnail: {
      type: String,
      trim: true,
    },
    instructor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    level: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      default: "beginner",
    },
    courses: {
      type: [learningPathCourseSchema],
      default: [],
    },
    enrolledStudents: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isPublished: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

learningPathSchema.index({ title: "text", description: "text" });

export const LearningPath = mongoose.model<ILearningPath>(
  "LearningPath",
  learningPathSchema
);

