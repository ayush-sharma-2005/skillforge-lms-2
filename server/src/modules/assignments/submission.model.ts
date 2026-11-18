import mongoose, { Schema, type Document } from "mongoose";

export interface ISimilarityMatch {
  submissionId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  score: number;
  matchedPassages?: string[];
}

export interface ISimilarityReport {
  highestScore: number;
  flaggedForReview: boolean;
  matches: ISimilarityMatch[];
  computedAt: Date;
}

export interface IRubricScore {
  criterion: string;
  score: number;
  feedback?: string;
}

export interface IAiEvaluation {
  suggestedScore: number;
  feedback: string;
  rubricScores: IRubricScore[];
  status: "suggested" | "approved" | "overridden";
  modelUsed?: string;
  evaluatedAt: Date;
}

export interface ISubmissionGrade {
  score: number;
  feedback: string;
  rubricScores: IRubricScore[];
  gradedBy: mongoose.Types.ObjectId;
  gradedAt: Date;
}

export interface ISubmission extends Document {
  assignment: mongoose.Types.ObjectId;
  course: mongoose.Types.ObjectId;
  student: mongoose.Types.ObjectId;
  content: string;
  language?: string;
  submittedAt: Date;
  status: "submitted" | "under_review" | "graded";
  similarityReport?: ISimilarityReport;
  aiEvaluation?: IAiEvaluation;
  grade?: ISubmissionGrade;
  createdAt: Date;
  updatedAt: Date;
}

const similarityMatchSchema = new Schema<ISimilarityMatch>(
  {
    submissionId: {
      type: Schema.Types.ObjectId,
      ref: "Submission",
      required: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    matchedPassages: [
      {
        type: String,
      },
    ],
  },
  { _id: false }
);

const similarityReportSchema = new Schema<ISimilarityReport>(
  {
    highestScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    flaggedForReview: {
      type: Boolean,
      default: false,
    },
    matches: {
      type: [similarityMatchSchema],
      default: [],
    },
    computedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const rubricScoreSchema = new Schema<IRubricScore>(
  {
    criterion: {
      type: String,
      required: true,
    },
    score: {
      type: Number,
      required: true,
    },
    feedback: {
      type: String,
    },
  },
  { _id: false }
);

const aiEvaluationSchema = new Schema<IAiEvaluation>(
  {
    suggestedScore: {
      type: Number,
      required: true,
    },
    feedback: {
      type: String,
      required: true,
    },
    rubricScores: {
      type: [rubricScoreSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ["suggested", "approved", "overridden"],
      default: "suggested",
    },
    modelUsed: {
      type: String,
    },
    evaluatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const gradeSchema = new Schema<ISubmissionGrade>(
  {
    score: {
      type: Number,
      required: true,
      min: 0,
    },
    feedback: {
      type: String,
      required: true,
    },
    rubricScores: {
      type: [rubricScoreSchema],
      default: [],
    },
    gradedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    gradedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const submissionSchema = new Schema<ISubmission>(
  {
    assignment: {
      type: Schema.Types.ObjectId,
      ref: "Assignment",
      required: true,
      index: true,
    },
    course: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
    },
    language: {
      type: String,
      trim: true,
      lowercase: true,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["submitted", "under_review", "graded"],
      default: "submitted",
      index: true,
    },
    similarityReport: {
      type: similarityReportSchema,
    },
    aiEvaluation: {
      type: aiEvaluationSchema,
    },
    grade: {
      type: gradeSchema,
    },
  },
  {
    timestamps: true,
  }
);

submissionSchema.index({ assignment: 1, student: 1 }, { unique: true });
submissionSchema.index({ assignment: 1, "similarityReport.flaggedForReview": 1 });
submissionSchema.index({ course: 1, student: 1 });

export const Submission = mongoose.model<ISubmission>(
  "Submission",
  submissionSchema
);

