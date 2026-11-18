import mongoose, { Schema, type Document, Types } from "mongoose";

export interface IResource extends Document {
  course: Types.ObjectId;
  lesson?: Types.ObjectId;
  title: string;
  description?: string;
  fileUrl: string;
  fileSize: number;
  fileType: string;
  isDownloadable: boolean;
  downloadCount: number;
  uploadedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const resourceSchema = new Schema<IResource>(
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
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 150,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    fileUrl: {
      type: String,
      required: true,
      trim: true,
    },
    fileSize: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    fileType: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      default: "pdf",
    },
    isDownloadable: {
      type: Boolean,
      default: true,
      index: true,
    },
    downloadCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

resourceSchema.index({ course: 1, isDownloadable: 1 });

export const Resource = mongoose.model<IResource>("Resource", resourceSchema);
