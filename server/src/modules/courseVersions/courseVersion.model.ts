import mongoose, { Schema, type Document, Types } from "mongoose";

export interface ICourseVersionLessonSnapshot {
  lessonId: Types.ObjectId;
  title: string;
  description: string;
  videoUrl?: string;
  duration: number;
  order: number;
  dripType?: string;
  transcript?: string;
  captions?: Array<{
    language: string;
    label: string;
    url: string;
  }>;
}

export interface ICourseVersionSnapshot {
  title: string;
  description: string;
  shortDescription?: string;
  category: string;
  level: string;
  price: number;
  language?: string;
  requirements: string[];
  learningOutcomes: string[];
  lessons: ICourseVersionLessonSnapshot[];
}

export interface ICourseVersion extends Document {
  course: Types.ObjectId;
  version: string;
  versionNumber: number;
  changelog: string;
  createdBy: Types.ObjectId;
  isCurrent: boolean;
  snapshot: ICourseVersionSnapshot;
  createdAt: Date;
  updatedAt: Date;
}

const lessonSnapshotSchema = new Schema<ICourseVersionLessonSnapshot>(
  {
    lessonId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    videoUrl: String,
    duration: {
      type: Number,
      required: true,
      min: 0,
    },
    order: {
      type: Number,
      required: true,
    },
    dripType: String,
    transcript: String,
    captions: [
      {
        language: String,
        label: String,
        url: String,
      },
    ],
  },
  { _id: false }
);

const courseSnapshotSchema = new Schema<ICourseVersionSnapshot>(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    shortDescription: String,
    category: {
      type: String,
      required: true,
    },
    level: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    language: String,
    requirements: [String],
    learningOutcomes: [String],
    lessons: [lessonSnapshotSchema],
  },
  { _id: false }
);

const courseVersionSchema = new Schema<ICourseVersion>(
  {
    course: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    version: {
      type: String,
      required: true,
      trim: true,
    },
    versionNumber: {
      type: Number,
      required: true,
    },
    changelog: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 2000,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isCurrent: {
      type: Boolean,
      default: true,
      index: true,
    },
    snapshot: {
      type: courseSnapshotSchema,
      required: true,
    },
  },
  { timestamps: true }
);

courseVersionSchema.index({ course: 1, version: 1 }, { unique: true });
courseVersionSchema.index({ course: 1, versionNumber: -1 });

export const CourseVersion = mongoose.model<ICourseVersion>(
  "CourseVersion",
  courseVersionSchema
);

