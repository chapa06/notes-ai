import { useState, useCallback } from "react";
import { apiRequest } from "../lib/api";
import type { Note } from "../types";

interface FetchNotesParams {
  categoryId?: string | null;
  searchQuery?: string;
  showArchived?: boolean;
}

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);

  const fetchNotes = useCallback(async (params: FetchNotesParams = {}) => {
    const { categoryId, searchQuery, showArchived } = params;
    const query = new URLSearchParams();
    if (categoryId) query.append("categoryId", categoryId);
    if (searchQuery) query.append("search", searchQuery);
    if (showArchived) query.append("archived", "true");

    try {
      const data = await apiRequest(`/notes?${query.toString()}`);
      setNotes(data);
    } catch (error) {
      console.error("Failed to fetch notes:", error);
    }
  }, []);

  const toggleArchive = useCallback(async (noteId: string, currentStatus: boolean) => {
    await apiRequest(`/notes/${noteId}`, {
      method: "PATCH",
      body: JSON.stringify({ isArchived: !currentStatus }),
    });
  }, []);

  const updateTopic = useCallback(async (noteId: string, topic: string) => {
    await apiRequest(`/notes/${noteId}`, {
      method: "PATCH",
      body: JSON.stringify({ topic }),
    });
  }, []);

  const changeCategory = useCallback(async (noteId: string, categoryId: string | null) => {
    await apiRequest(`/notes/${noteId}`, {
      method: "PATCH",
      body: JSON.stringify({ categoryId }),
    });
  }, []);

  const deleteNote = useCallback(async (noteId: string) => {
    await apiRequest(`/notes/${noteId}`, { method: "DELETE" });
  }, []);

  return { notes, setNotes, fetchNotes, toggleArchive, updateTopic, changeCategory, deleteNote };
}