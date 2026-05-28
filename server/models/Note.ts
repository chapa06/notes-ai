import mongoose, { Schema, Document } from "mongoose";

export interface INote extends Document {
  content: string;
  topic?: string;
  summary?: string;
  externalId?: string;
  source?: string;
  isArchived: boolean;
  userId: mongoose.Types.ObjectId;
  categoryId: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const noteSchema = new Schema<INote>({
  content: { type: String, required: true },
  topic: String,
  summary: String,
  externalId: { type: String, unique: true, sparse: true },
  source: String,
  isArchived: { type: Boolean, default: false },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  categoryId: { type: Schema.Types.ObjectId, ref: "Category", default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const Note = mongoose.model<INote>("Note", noteSchema);