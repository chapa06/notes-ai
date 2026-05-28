import { Request } from "express";

export interface JwtPayload {
  id: string;
  telegramId: string;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

export interface TelegramAuthData {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export interface CreateNoteBody {
  telegramId: string;
  content: string;
  categoryName?: string;
  externalId?: string;
  source?: string;
  topic?: string;
  summary?: string;
}

export interface UpdateNoteBody {
  isArchived?: boolean;
  categoryId?: string;
  topic?: string;
  summary?: string;
}