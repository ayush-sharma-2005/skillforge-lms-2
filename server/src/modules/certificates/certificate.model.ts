import mongoose, { Schema, type Document } from "mongoose";

export interface IRenewalRecord {
  renewedAt: Date;
  previousExpiresAt?: Date;
  newExpiresAt: Date;
  renewedBy: mongoose.Types.ObjectId;
  notes?: string;
}

export interface ICertificateMetadata {
  studentName: string;
  courseTitle: string;
  instructorName: string;
  completionDate: Date;
  gradeAverage?: number;
}

export interface ICertificate extends Document {
  verificationId: string;
  student: mongoose.Types.ObjectId;
  course: mongoose.Types.ObjectId;
  issuedAt: Date;
  validityMonths: number;
  expiresAt?: Date;
  status: "active" | "expired" | "renewed" | "revoked";
  renewalHistory: IRenewalRecord[];
  metadata: ICertificateMetadata;
  revokedAt?: Date;
  revocationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const renewalRecordSchema = new Schema<IRenewalRecord>(
  {
    renewedAt: {
      type: Date,
      default: Date.now,
    },
    previousExpiresAt: {
      type: Date,
    },
    newExpiresAt: {
      type: Date,
      required: true,
    },
    renewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const certificateMetadataSchema = new Schema<ICertificateMetadata>(
  {
    studentName: { type: String, required: true },
    courseTitle: { type: String, required: true },
    instructorName: { type: String, required: true },
    completionDate: { type: Date, required: true },
    gradeAverage: { type: Number },
  },
  { _id: false }
);

const certificateSchema = new Schema<ICertificate>(
  {
    verificationId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
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
    issuedAt: {
      type: Date,
      default: Date.now,
    },
    validityMonths: {
      type: Number,
      default: 12, // 1 year default validity
      min: 0,
    },
    expiresAt: {
      type: Date,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "expired", "renewed", "revoked"],
      default: "active",
      index: true,
    },
    renewalHistory: {
      type: [renewalRecordSchema],
      default: [],
    },
    metadata: {
      type: certificateMetadataSchema,
      required: true,
    },
    revokedAt: {
      type: Date,
    },
    revocationReason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

certificateSchema.index({ student: 1, course: 1 });

export const Certificate = mongoose.model<ICertificate>(
  "Certificate",
  certificateSchema
);

