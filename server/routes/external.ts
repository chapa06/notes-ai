import { Router, Response } from "express";
import mongoose from "mongoose";
import { getOrCreateUser } from "../models/helpers";
import { Category } from "../models/Category";
import { Note } from "../models/Note";
import { CreateNoteBody } from "../types";

const router = Router();

// External API: Receive Note
router.post("/api/external/notes", async (req, res: Response) => {
  const { telegramId, content, categoryName, externalId, source, topic, summary } =
    req.body as CreateNoteBody;

  if (!telegramId || !content) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  try {
    const user = await getOrCreateUser(String(telegramId));
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const cat = await Category.findOneAndUpdate(
      { userId: user._id, name: categoryName || "Без категории" },
      {
        $set: {
          name: categoryName || "Без категории",
          userId: user._id,
        },
      },
      { upsert: true, new: true }
    );

    let note;
    if (externalId) {
      note = await Note.findOneAndUpdate(
        { externalId },
        {
          $set: {
            content,
            topic,
            summary,
            source,
            userId: user._id,
            categoryId: cat._id,
            updatedAt: new Date(),
          },
        },
        { upsert: true, new: true }
      );
    } else {
      note = await Note.create({
        content,
        topic,
        summary,
        source,
        userId: user._id,
        categoryId: cat._id,
      });
    }

    res.status(201).json(note);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;