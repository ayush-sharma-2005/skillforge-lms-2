import { Schema, model, Types, Document } from "mongoose";

export type EnrollmentStatus = "active" | "pending" | "cancelled";

export type PaymentStatus = "free" | "pending" | "paid" | "failed";

export interface IEnrollment extends Document {
student: Types.ObjectId;
course: Types.ObjectId;
status: EnrollmentStatus;
paymentStatus: PaymentStatus;
amount: number;
paymentId?: string;
enrolledAt?: Date;
}

const enrollmentSchema = new Schema<IEnrollment>(
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
status: {
type: String,
enum: ["active", "pending", "cancelled"],
default: "pending",
required: true,
},
paymentStatus: {
type: String,
enum: ["free", "pending", "paid", "failed"],
required: true,
},
amount: {
type: Number,
required: true,
min: 0,
},
paymentId: {
type: String,
trim: true,
},
enrolledAt: {
type: Date,
},
},
{
timestamps: true,
}
);

enrollmentSchema.index(
{ student: 1, course: 1 },
{ unique: true }
);

const Enrollment = model<IEnrollment>(
"Enrollment",
enrollmentSchema
);

export default Enrollment;

