import mongoose, { Schema, type Document, Types } from "mongoose";

export interface IDiscussionReport {
  reportedBy: Types.ObjectId;
  reason: string;
  createdAt: Date;
}

export interface IDiscussion extends Document {
  course: Types.ObjectId;
  lesson: Types.ObjectId;
  user: Types.ObjectId;
  content: string;
  parentDiscussionId?: Types.ObjectId | null;
  isPinned: boolean;
  isInstructorReply: boolean;
  status: "active" | "flagged" | "hidden";
  reports: IDiscussionReport[];
  createdAt: Date;
  updatedAt: Date;
}

const discussionReportSchema = new Schema<IDiscussionReport>(
  {
    reportedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const discussionSchema = new Schema<IDiscussion>(
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
      required: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 2000,
    },
    parentDiscussionId: {
      type: Schema.Types.ObjectId,
      ref: "Discussion",
      default: null,
      index: true,
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    isInstructorReply: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["active", "flagged", "hidden"],
      default: "active",
      index: true,
    },
    reports: {
      type: [discussionReportSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

discussionSchema.index({ lesson: 1, parentDiscussionId: 1, isPinned: -1, createdAt: -1 });
discussionSchema.index({ course: 1, status: 1 });

export const Discussion = mongoose.model<IDiscussion>(
  "Discussion",
  discussionSchema
);

