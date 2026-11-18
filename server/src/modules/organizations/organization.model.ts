import mongoose, { Schema, type Document } from "mongoose";

export interface IOrganizationSettings {
  allowOpenRegistration: boolean;
  requireDomainMatch: boolean;
  maxStudents: number;
  features: {
    analytics: boolean;
    certificates: boolean;
    codeReview: boolean;
  };
}

export interface IOrganization extends Document {
  name: string;
  slug: string;
  code: string;
  domain?: string;
  description?: string;
  website?: string;
  logo?: string;
  adminUsers: mongoose.Types.ObjectId[];
  instructors: mongoose.Types.ObjectId[];
  students: mongoose.Types.ObjectId[];
  courses: mongoose.Types.ObjectId[];
  settings: IOrganizationSettings;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const organizationSettingsSchema = new Schema<IOrganizationSettings>(
  {
    allowOpenRegistration: {
      type: Boolean,
      default: false,
    },
    requireDomainMatch: {
      type: Boolean,
      default: false,
    },
    maxStudents: {
      type: Number,
      default: 500,
      min: 1,
    },
    features: {
      analytics: { type: Boolean, default: true },
      certificates: { type: Boolean, default: true },
      codeReview: { type: Boolean, default: true },
    },
  },
  { _id: false }
);

const organizationSchema = new Schema<IOrganization>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    domain: {
      type: String,
      lowercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    website: {
      type: String,
      trim: true,
    },
    logo: {
      type: String,
      trim: true,
    },
    adminUsers: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        index: true,
      },
    ],
    instructors: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        index: true,
      },
    ],
    students: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        index: true,
      },
    ],
    courses: [
      {
        type: Schema.Types.ObjectId,
        ref: "Course",
        index: true,
      },
    ],
    settings: {
      type: organizationSettingsSchema,
      default: () => ({}),
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Organization = mongoose.model<IOrganization>(
  "Organization",
  organizationSchema
);
