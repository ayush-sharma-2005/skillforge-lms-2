import mongoose, { Schema, type Document, Types } from "mongoose";

export interface ILearningSession extends Document {
  student: Types.ObjectId;
  course: Types.ObjectId;
  lesson: Types.ObjectId;
  sessionDate: string; // Formatted YYYY-MM-DD
  durationSeconds: number;
  lastHeartbeatAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const learningSessionSchema = new Schema<ILearningSession>(
  {
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
    lesson: {
      type: Schema.Types.ObjectId,
      ref: "Lesson",
      required: true,
      index: true,
    },
    sessionDate: {
      type: String,
      required: true,
      index: true,
    },
    durationSeconds: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    lastHeartbeatAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

learningSessionSchema.index(
  { student: 1, course: 1, lesson: 1, sessionDate: 1 },
  { unique: true }
);

learningSessionSchema.index({ course: 1, sessionDate: 1 });
learningSessionSchema.index({ student: 1, sessionDate: 1 });

export const LearningSession = mongoose.model<ILearningSession>(
  "LearningSession",
  learningSessionSchema
);

