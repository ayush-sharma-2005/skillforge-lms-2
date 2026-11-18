import mongoose, { Schema, type Document, Types } from "mongoose";

export interface IDownloadLog extends Document {
  resource: Types.ObjectId;
  student: Types.ObjectId;
  course: Types.ObjectId;
  downloadedAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

const downloadLogSchema = new Schema<IDownloadLog>(
  {
    resource: {
      type: Schema.Types.ObjectId,
      ref: "Resource",
      required: true,
      index: true,
    },
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    course: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    downloadedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
  },
  { timestamps: false }
);

downloadLogSchema.index({ course: 1, downloadedAt: -1 });

export const DownloadLog = mongoose.model<IDownloadLog>(
  "DownloadLog",
  downloadLogSchema
);

