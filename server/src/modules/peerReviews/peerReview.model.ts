import mongoose, { Schema, type Document } from "mongoose";

export interface ICodeComment {
  line: number;
  comment: string;
  createdAt: Date;
}

export interface IPeerReview extends Document {
  assignment: mongoose.Types.ObjectId;
  submission: mongoose.Types.ObjectId;
  course: mongoose.Types.ObjectId;
  author: mongoose.Types.ObjectId;
  reviewer: mongoose.Types.ObjectId;
  status: "assigned" | "in_progress" | "completed" | "expired";
  deadline: Date;
  score?: number;
  feedback?: string;
  codeComments: ICodeComment[];
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const codeCommentSchema = new Schema<ICodeComment>(
  {
    line: {
      type: Number,
      required: true,
      min: 1,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const peerReviewSchema = new Schema<IPeerReview>(
  {
    assignment: {
      type: Schema.Types.ObjectId,
      ref: "Assignment",
      required: true,
      index: true,
    },
    submission: {
      type: Schema.Types.ObjectId,
      ref: "Submission",
      required: true,
      index: true,
    },
    course: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reviewer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["assigned", "in_progress", "completed", "expired"],
      default: "assigned",
      index: true,
    },
    deadline: {
      type: Date,
      required: true,
    },
    score: {
      type: Number,
      min: 0,
      max: 100,
    },
    feedback: {
      type: String,
      trim: true,
    },
    codeComments: {
      type: [codeCommentSchema],
      default: [],
    },
    submittedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

peerReviewSchema.index({ submission: 1, reviewer: 1 }, { unique: true });
peerReviewSchema.index({ reviewer: 1, status: 1 });
peerReviewSchema.index({ author: 1, assignment: 1 });

export const PeerReview = mongoose.model<IPeerReview>(
  "PeerReview",
  peerReviewSchema
);

