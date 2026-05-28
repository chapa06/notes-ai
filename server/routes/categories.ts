import { Router, Response } from "express";
import mongoose from "mongoose";
import { authenticateToken } from "../middleware/auth";
import { AuthenticatedRequest } from "../types";
import { Category } from "../models/Category";
import { Note } from "../models/Note";
import { User } from "../models/User";

const router = Router();

// Get Categories
router.get("/api/categories", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user!.id);
    const categories = await Category.aggregate([
      {
        $match: {
          $or: [{ userId }, { userId: null }],
        },
      },
      {
        $lookup: {
          from: "notes",
          let: { categoryId: "$_id", userId },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$categoryId", "$$categoryId"] },
                    { $eq: ["$userId", "$$userId"] },
                    { $eq: ["$isArchived", false] },
                  ],
                },
              },
            },
            { $count: "count" },
          ],
          as: "notesCount",
        },
      },
      {
        $addFields: {
          noteCount: {
            $ifNull: [{ $arrayElemAt: ["$notesCount.count", 0] }, 0],
          },
        },
      },
      { $sort: { name: 1 } },
      {
        $project: {
          id: "$_id",
          name: 1,
          _count: { notes: "$noteCount" },
        },
      },
    ]);
    res.json(categories);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Create Category
router.post("/api/categories", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    res.status(400).json({ error: "Category name is required" });
    return;
  }

  try {
    const cat = await Category.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(req.user!.id), name: name.trim() },
      { $set: { name: name.trim(), userId: new mongoose.Types.ObjectId(req.user!.id) } },
      { upsert: true, new: true }
    );
    res.status(201).json({
      id: cat._id,
      name: cat.name,
      _count: { notes: 0 },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Delete Category
router.delete("/api/categories/:id", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const cat = await Category.findOneAndDelete({
      _id: id,
      userId: new mongoose.Types.ObjectId(req.user!.id),
    });
    if (!cat) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    const deletedNotes = await Note.deleteMany({
      categoryId: id,
      userId: new mongoose.Types.ObjectId(req.user!.id),
    });
    res.json({
      message: "Category deleted",
      id: cat._id,
      deletedNotes: deletedNotes.deletedCount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Get public categories list (no auth needed, for bot)
router.get("/api/public/categories", async (req, res: Response) => {
  try {
    const { telegramId } = req.query;
    let categories;
    if (telegramId) {
      const user = await User.findOne({ telegramId: String(telegramId) });
      if (!user) {
        res.json([]);
        return;
      }
      categories = await Category.find({ userId: user._id }).sort({ name: 1 });
    } else {
      categories = await Category.find({ userId: null }).sort({ name: 1 });
    }
    res.json(categories.map((c) => ({ id: c._id, name: c.name })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

export default router;