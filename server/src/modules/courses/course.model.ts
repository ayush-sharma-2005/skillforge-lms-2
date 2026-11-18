import mongoose, { Schema, type Document } from "mongoose";

export interface ICourseTranslation {
  language: string;
  title: string;
  description: string;
  shortDescription?: string;
}

export interface ICourse extends Document {
  title: string;
  description: string;
  shortDescription: string;
  thumbnail?: string;
  price: number;
  category: string;
  level: "beginner" | "intermediate" | "advanced";
  language: string;
  supportedLanguages: string[];
  translations: ICourseTranslation[];
  instructor: mongoose.Types.ObjectId;
  isPublished: boolean;
  requirements: string[];
  learningOutcomes: string[];
  prerequisites: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const courseTranslationSchema = new Schema<ICourseTranslation>(
  {
    language: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    shortDescription: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const courseSchema = new Schema<ICourse>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 150,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 20,
    },
    shortDescription: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    thumbnail: {
      type: String,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
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
    language: {
      type: String,
      required: true,
      trim: true,
      default: "en",
    },
    supportedLanguages: {
      type: [String],
      default: ["en"],
    },
    translations: {
      type: [courseTranslationSchema],
      default: [],
    },
    instructor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    isPublished: {
      type: Boolean,
      default: false,
      index: true,
    },
    requirements: {
      type: [String],
      default: [],
    },
    learningOutcomes: {
      type: [String],
      default: [],
    },
    prerequisites: [
      {
        type: Schema.Types.ObjectId,
        ref: "Course",
      },
    ],
  },
  {
    timestamps: true,
  }
);

courseSchema.index({ title: "text", description: "text" });

export const Course = mongoose.model<ICourse>("Course", courseSchema);
