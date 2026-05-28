export interface User {
  id: string;
  telegramId: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
}

export interface Category {
  id: string;
  name: string;
  _count: {
    notes: number;
  };
}

export interface Note {
  id: string;
  content: string;
  topic?: string;
  summary?: string;
  source?: string;
  isArchived: boolean;
  createdAt: string;
  category: {
    id: string;
    name: string;
  } | null;
}

export interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}