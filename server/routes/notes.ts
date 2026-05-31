import { Router, Response } from "express";
import mongoose from "mongoose";
import { authenticateToken } from "../middleware/auth";
import { AuthenticatedRequest } from "../types";
import { Note } from "../models/Note";

const router = Router();

// Get Notes
router.get("/api/notes", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { categoryId, search, archived } = req.query;
  const filter: Record<string, unknown> = { userId: new mongoose.Types.ObjectId(req.user!.id) };

  if (categoryId) {
    filter.categoryId = new mongoose.Types.ObjectId(String(categoryId));
  }
  if (archived === "true") {
    filter.isArchived = true;
  } else {
    filter.isArchived = false;
  }
  if (search) {
    filter.content = { $regex: String(search), $options: "i" };
  }

  try {
    const notes = await Note.find(filter)
      .populate("categoryId", "name")
      .sort({ createdAt: -1 });
    res.json(
      notes.map((n) => ({
        id: n._id,
        content: n.content,
        topic: n.topic,
        summary: n.summary,
        source: n.source,
        isArchived: n.isArchived,
        createdAt: n.createdAt,
        category: n.categoryId
          ? { id: n.categoryId._id, name: (n.categoryId as unknown as { name: string }).name }
          : null,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Update Note (Archive/Move/Rename)
router.patch("/api/notes/:id", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { isArchived, categoryId, topic, summary } = req.body;

  try {
    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (isArchived !== undefined) update.isArchived = isArchived;
    if (categoryId !== undefined)
      update.categoryId = new mongoose.Types.ObjectId(categoryId);
    if (topic !== undefined) update.topic = topic;
    if (summary !== undefined) update.summary = summary;

    const note = await Note.findOneAndUpdate(
      { _id: id, userId: new mongoose.Types.ObjectId(req.user!.id) },
      { $set: update },
      { new: true }
    ).populate("categoryId", "name");

    if (!note) {
      res.status(404).json({ error: "Note not found" });
      return;
    }
    res.json(note);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Delete Note
router.delete("/api/notes/:id", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    await Note.findOneAndDelete({
      _id: id,
      userId: new mongoose.Types.ObjectId(req.user!.id),
    });
    res.sendStatus(204);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});
export default router;
