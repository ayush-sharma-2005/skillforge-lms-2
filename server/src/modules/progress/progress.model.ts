import { Schema, model, Types, Document } from "mongoose";

export interface IProgress extends Document {
student: Types.ObjectId;
course: Types.ObjectId;
completedLessons: Types.ObjectId[];
lastAccessedAt?: Date;
}

const progressSchema = new Schema<IProgress>(
{
student: {
type: Schema.Types.ObjectId,
ref: "User",
required: true,
},
course: {
type: Schema.Types.ObjectId,
ref: "Course",
required: true,
},
completedLessons: [
{
type: Schema.Types.ObjectId,
ref: "Lesson",
},
],
lastAccessedAt: {
type: Date,
},
},
{ timestamps: true }
);

// Har student ke liye ek course ka sirf ek progress record.
progressSchema.index({ student: 1, course: 1 }, { unique: true });

const Progress = model<IProgress>("Progress", progressSchema);

export default Progress;
