import dotenv from "dotenv";

dotenv.config();

export const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/notes_hub";
export const JWT_SECRET = process.env.JWT_SECRET || "notes-hub-secret-key";
export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
export const PORT = parseInt(process.env.PORT || "3000", 10);
export const NODE_ENV = process.env.NODE_ENV || "development";

export const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;