import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/notes_hub";
const JWT_SECRET = process.env.JWT_SECRET || "notes-hub-secret-key";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// ─── Mongoose Schemas ─────────────────────────────────────────────────────

const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  firstName: String,
  lastName: String,
  username: String,
  photoUrl: String,
  createdAt: { type: Date, default: Date.now },
});

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  createdAt: { type: Date, default: Date.now },
});

// Категория уникальна в рамках пользователя (или глобальная если userId=null)
categorySchema.index({ userId: 1, name: 1 }, { unique: true });

const noteSchema = new mongoose.Schema({
  content: { type: String, required: true },
  topic: String,
  summary: String,
  externalId: { type: String, unique: true, sparse: true },
  source: String,
  isArchived: { type: Boolean, default: false },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);
const Category = mongoose.model("Category", categorySchema);
const Note = mongoose.model("Note", noteSchema);

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getOrCreateUser(telegramId: string, userData?: any) {
  if (userData) {
    return await User.findOneAndUpdate(
      { telegramId },
      {
        $set: {
          firstName: userData.first_name || userData.firstName,
          lastName: userData.last_name || userData.lastName,
          username: userData.username,
          photoUrl: userData.photo_url || userData.photoUrl,
        },
      },
      { upsert: true, new: true }
    );
  }
  return await User.findOne({ telegramId });
}

// ─── Server ─────────────────────────────────────────────────────────────────

async function startServer() {
  // Подключаемся к MongoDB
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ MongoDB connected:", MONGODB_URI);
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  }

  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // --- Middleware: Auth ---
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      // Проверяем, что id — валидный MongoDB ObjectId (24 hex символа)
      if (!user.id || !/^[0-9a-fA-F]{24}$/.test(user.id)) {
        return res.status(401).json({ error: "Invalid token format. Please re-login." });
      }
      req.user = user;
      next();
    });
  };

  // --- API Routes ---

  // Telegram Auth Validation
  app.post("/api/auth/telegram", async (req, res) => {
    const { hash, ...data } = req.body;

    if (!TELEGRAM_BOT_TOKEN) {
      console.warn("TELEGRAM_BOT_TOKEN not set. Skipping validation for development.");
    } else {
      const secretKey = crypto.createHash("sha256").update(TELEGRAM_BOT_TOKEN).digest();
      const checkString = Object.keys(data)
        .sort()
        .map((key) => `${key}=${data[key]}`)
        .join("\n");
      const hmac = crypto.createHmac("sha256", secretKey).update(checkString).digest("hex");

      if (hmac !== hash) {
        return res.status(401).json({ error: "Invalid hash" });
      }
    }

    try {
      const user = await getOrCreateUser(String(data.id), data);
      if (!user) return res.status(500).json({ error: "Failed to create user" });
      const token = jwt.sign(
        { id: user._id.toString(), telegramId: user.telegramId },
        JWT_SECRET
      );
      res.json({
        token,
        user: {
          id: user._id,
          telegramId: user.telegramId,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          photoUrl: user.photoUrl,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // Get Categories
  app.get("/api/categories", authenticateToken, async (req: any, res) => {
    try {
      const userId = new mongoose.Types.ObjectId(req.user.id);
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
  app.post("/api/categories", authenticateToken, async (req: any, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Category name is required" });
    }
    try {
      const cat = await Category.findOneAndUpdate(
        { userId: new mongoose.Types.ObjectId(req.user.id), name: name.trim() },
        { $set: { name: name.trim(), userId: new mongoose.Types.ObjectId(req.user.id) } },
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
  app.delete("/api/categories/:id", authenticateToken, async (req: any, res) => {
    const { id } = req.params;
    try {
      const cat = await Category.findOneAndDelete({
        _id: id,
        userId: new mongoose.Types.ObjectId(req.user.id),
      });
      if (!cat) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json({ message: "Category deleted", id: cat._id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // Get public categories list (no auth needed, for bot)
  app.get("/api/public/categories", async (req, res) => {
    try {
      const { telegramId } = req.query;
      let categories;
      if (telegramId) {
        const user = await User.findOne({ telegramId: String(telegramId) });
        if (!user) {
          return res.json([]);
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

  // Get Notes
  app.get("/api/notes", authenticateToken, async (req: any, res) => {
    const { categoryId, search, archived } = req.query;
    const filter: any = { userId: new mongoose.Types.ObjectId(req.user.id) };

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
            ? { id: n.categoryId._id, name: (n.categoryId as any).name }
            : null,
        }))
      );
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // Update Note (Archive/Move/Rename)
  app.patch("/api/notes/:id", authenticateToken, async (req: any, res) => {
    const { id } = req.params;
    const { isArchived, categoryId, topic, summary } = req.body;

    try {
      const update: any = { updatedAt: new Date() };
      if (isArchived !== undefined) update.isArchived = isArchived;
      if (categoryId !== undefined)
        update.categoryId = new mongoose.Types.ObjectId(categoryId);
      if (topic !== undefined) update.topic = topic;
      if (summary !== undefined) update.summary = summary;

      const note = await Note.findOneAndUpdate(
        { _id: id, userId: new mongoose.Types.ObjectId(req.user.id) },
        { $set: update },
        { new: true }
      ).populate("categoryId", "name");

      if (!note) return res.status(404).json({ error: "Note not found" });
      res.json(note);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // Delete Note
  app.delete("/api/notes/:id", authenticateToken, async (req: any, res) => {
    const { id } = req.params;
    try {
      await Note.findOneAndDelete({
        _id: id,
        userId: new mongoose.Types.ObjectId(req.user.id),
      });
      res.sendStatus(204);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // External API: Receive Note
  app.post("/api/external/notes", async (req, res) => {
    const { telegramId, content, categoryName, externalId, source, topic, summary } = req.body;

    if (!telegramId || !content) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      const user = await getOrCreateUser(String(telegramId));
      if (!user) return res.status(404).json({ error: "User not found" });

      // Создаём категорию с привязкой к пользователю
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
              content, topic, summary, source,
              userId: user._id,
              categoryId: cat._id,
              updatedAt: new Date(),
            },
          },
          { upsert: true, new: true }
        );
      } else {
        note = await Note.create({
          content, topic, summary, source,
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

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();