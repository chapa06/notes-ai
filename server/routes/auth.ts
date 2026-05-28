import { Router, Response } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { TELEGRAM_BOT_TOKEN, JWT_SECRET } from "../config";
import { getOrCreateUser } from "../models/helpers";
import { TelegramAuthData } from "../types";

const router = Router();

// Telegram Auth Validation
router.post("/api/auth/telegram", async (req, res: Response) => {
  const { hash, ...data } = req.body as TelegramAuthData;

  if (TELEGRAM_BOT_TOKEN) {
    const secretKey = crypto.createHash("sha256").update(TELEGRAM_BOT_TOKEN).digest();
    const checkString = Object.keys(data)
      .sort()
      .map((key) => `${key}=${data[key as keyof typeof data]}`)
      .join("\n");
    const hmac = crypto.createHmac("sha256", secretKey).update(checkString).digest("hex");

    if (hmac !== hash) {
      res.status(401).json({ error: "Invalid hash" });
      return;
    }
  }

  try {
    const user = await getOrCreateUser(String(data.id), data as unknown as Record<string, unknown>);
    if (!user) {
      res.status(500).json({ error: "Failed to create user" });
      return;
    }

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

export default router;