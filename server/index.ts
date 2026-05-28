import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import mongoose from "mongoose";
import { MONGODB_URI, PORT, NODE_ENV } from "./config";
import authRouter from "./routes/auth";
import categoriesRouter from "./routes/categories";
import notesRouter from "./routes/notes";
import externalRouter from "./routes/external";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer(): Promise<void> {
  // Connect to MongoDB
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ MongoDB connected:", MONGODB_URI);
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  }

  const app = express();

  app.use(cors());
  app.use(express.json());

  // API Routes
  app.use(authRouter);
  app.use(categoriesRouter);
  app.use(notesRouter);
  app.use(externalRouter);

  // Vite Middleware (dev) or static files (production)
  if (NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();