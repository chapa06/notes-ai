import { Search, Tag } from "lucide-react";
import type { Category } from "../types";

interface TopBarProps {
  searchQuery: string;
  notesCount: number;
  selectedCategoryId: string | null;
  showArchived: boolean;
  categories: Category[];
  onSearchChange: (value: string) => void;
}

export function TopBar({
  searchQuery, notesCount, selectedCategoryId, showArchived, categories, onSearchChange,
}: TopBarProps) {
  const currentLabel = showArchived
    ? "Архив"
    : selectedCategoryId
      ? categories.find(c => c.id === selectedCategoryId)?.name
      : "Все заметки";

  return (
    <header className="bg-card border-b border-border">
      <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
          <input
            type="text"
            placeholder="Поиск заметок..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-xl text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-text-muted hidden sm:block">
            <span className="font-semibold text-text">{notesCount}</span> заметок
          </div>
          <div className="h-5 w-px bg-border hidden sm:block" />
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-surface text-sm text-text-secondary">
            <Tag size={14} />
            <span className="font-medium">{currentLabel}</span>
          </div>
        </div>
      </div>
    </header>
  );
}