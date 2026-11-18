import { Schema, model, Types, Document } from "mongoose";

export type DripType = "none" | "date" | "enrollment_days";

export interface ILessonTranslation {
  language: string;
  title: string;
  description: string;
  transcript?: string;
}

export interface ILessonCaption {
  language: string;
  label: string;
  url: string;
  isDefault?: boolean;
}

export interface ILessonAccessibility {
  estimatedReadingTimeMinutes?: number;
  screenReaderNotes?: string;
  hasHighContrastSupport?: boolean;
}

export interface ILesson extends Document {
  course: Types.ObjectId;
  title: string;
  description: string;
  videoUrl?: string;
  duration: number;
  order: number;
  isPublished: boolean;
  dripType: DripType;
  unlockDate?: Date;
  unlockAfterDays?: number;
  transcript?: string;
  audioDescriptionUrl?: string;
  captions: ILessonCaption[];
  accessibility?: ILessonAccessibility;
  translations: ILessonTranslation[];
  createdAt: Date;
  updatedAt: Date;
}

const lessonCaptionSchema = new Schema<ILessonCaption>(
  {
    language: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const lessonAccessibilitySchema = new Schema<ILessonAccessibility>(
  {
    estimatedReadingTimeMinutes: {
      type: Number,
      min: 0,
    },
    screenReaderNotes: {
      type: String,
      trim: true,
    },
    hasHighContrastSupport: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const lessonTranslationSchema = new Schema<ILessonTranslation>(
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
    transcript: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const lessonSchema = new Schema<ILesson>(
  {
    course: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    videoUrl: {
      type: String,
      trim: true,
    },
    duration: {
      type: Number,
      required: true,
      min: 0,
    },
    order: {
      type: Number,
      required: true,
      min: 1,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    dripType: {
      type: String,
      enum: ["none", "date", "enrollment_days"],
      default: "none",
    },
    unlockDate: {
      type: Date,
    },
    unlockAfterDays: {
      type: Number,
      min: 0,
    },
    transcript: {
      type: String,
      trim: true,
    },
    audioDescriptionUrl: {
      type: String,
      trim: true,
    },
    captions: {
      type: [lessonCaptionSchema],
      default: [],
    },
    accessibility: {
      type: lessonAccessibilitySchema,
      default: () => ({ hasHighContrastSupport: true }),
    },
    translations: {
      type: [lessonTranslationSchema],
      default: [],
    },
  },
  { timestamps: true }
);

lessonSchema.index({ course: 1, order: 1 }, { unique: true });

const Lesson = model<ILesson>("Lesson", lessonSchema);

export default Lesson;
