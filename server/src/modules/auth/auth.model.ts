import mongoose, { Schema, type Document } from "mongoose";

export type UserRole = "student" | "instructor" | "admin" | "org_admin";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  organization?: mongoose.Types.ObjectId;
  isEmailVerified: boolean;
  isActive: boolean;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: String,
      enum: ["student", "instructor", "admin", "org_admin"],
      default: "student",
    },

    organization: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      index: true,
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    passwordResetToken: {
      type: String,
      select: false,
    },

    passwordResetExpires: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.model<IUser>("User", userSchema);