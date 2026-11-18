import mongoose, { Schema, Document } from "mongoose";

export interface IWishlist extends Document {
  student: mongoose.Types.ObjectId;
  course: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const wishlistSchema = new Schema<IWishlist>(
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
  },
  {
    timestamps: true,
  }
);

// Same course ko wishlist mein duplicate add hone se rokega.
wishlistSchema.index(
  { student: 1, course: 1 },
  { unique: true }
);

const Wishlist = mongoose.model<IWishlist>(
  "Wishlist",
  wishlistSchema
);

export default Wishlist;