import mongoose, { Schema, Document } from "mongoose";

export interface ICategory extends Document {
  name: string;
  userId: mongoose.Types.ObjectId | null;
  createdAt: Date;
}

const categorySchema = new Schema<ICategory>({
  name: { type: String, required: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  createdAt: { type: Date, default: Date.now },
});

categorySchema.index({ userId: 1, name: 1 }, { unique: true });

export const Category = mongoose.model<ICategory>("Category", categorySchema);