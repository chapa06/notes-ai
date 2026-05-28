import { useState, useCallback } from "react";
import { apiRequest } from "../lib/api";
import type { Category } from "../types";

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);

  const fetchCategories = useCallback(async () => {
    try {
      const data = await apiRequest("/categories");
      setCategories(data);
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    }
  }, []);

  const createCategory = useCallback(async (name: string) => {
    await apiRequest("/categories", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    await fetchCategories();
  }, [fetchCategories]);

  const deleteCategory = useCallback(async (catId: string) => {
    await apiRequest(`/categories/${catId}`, { method: "DELETE" });
    await fetchCategories();
  }, [fetchCategories]);

  return { categories, fetchCategories, createCategory, deleteCategory, setCategories };
}