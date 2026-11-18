import mongoose, { Schema, type Document } from "mongoose";

export interface IGuardianPermissions {
  viewCourses: boolean;
  viewProgress: boolean;
  viewCertificates: boolean;
  viewAttendanceTime: boolean;
}

export interface IGuardianAccess extends Document {
  student: mongoose.Types.ObjectId;
  guardianEmail: string;
  guardianUser?: mongoose.Types.ObjectId;
  relationship: "parent" | "guardian" | "sponsor" | "mentor";
  inviteToken: string;
  status: "pending" | "accepted" | "rejected" | "revoked";
  permissions: IGuardianPermissions;
  invitedAt: Date;
  acceptedAt?: Date;
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const guardianPermissionsSchema = new Schema<IGuardianPermissions>(
  {
    viewCourses: { type: Boolean, default: true },
    viewProgress: { type: Boolean, default: true },
    viewCertificates: { type: Boolean, default: true },
    viewAttendanceTime: { type: Boolean, default: true },
  },
  { _id: false }
);

const guardianAccessSchema = new Schema<IGuardianAccess>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    guardianEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    guardianUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    relationship: {
      type: String,
      enum: ["parent", "guardian", "sponsor", "mentor"],
      default: "parent",
      required: true,
    },
    inviteToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "revoked"],
      default: "pending",
      index: true,
    },
    permissions: {
      type: guardianPermissionsSchema,
      default: () => ({}),
    },
    invitedAt: {
      type: Date,
      default: Date.now,
    },
    acceptedAt: {
      type: Date,
    },
    revokedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

guardianAccessSchema.index({ student: 1, guardianEmail: 1 });
guardianAccessSchema.index({ guardianUser: 1, status: 1 });

export const GuardianAccess = mongoose.model<IGuardianAccess>(
  "GuardianAccess",
  guardianAccessSchema
);

