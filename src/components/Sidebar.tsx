import { cn } from "../lib/utils";
import { Sparkles, LogOut, Inbox, Archive, Hash, Plus, Trash2 } from "lucide-react";
import type { User, Category } from "../types";

interface SidebarProps {
  user: User;
  categories: Category[];
  selectedCategoryId: string | null;
  showArchived: boolean;
  isSidebarOpen: boolean;
  onSelectAll: () => void;
  onSelectArchived: () => void;
  onSelectCategory: (id: string) => void;
  onCreateCategory: () => void;
  onDeleteCategory: (id: string, name: string) => void;
  onLogout: () => void;
  onClose: () => void;
}

export function Sidebar({
  user, categories, selectedCategoryId, showArchived, isSidebarOpen,
  onSelectAll, onSelectArchived, onSelectCategory, onCreateCategory,
  onDeleteCategory, onLogout, onClose,
}: SidebarProps) {
  return (
    <>
      <aside className={cn(
        "fixed inset-0 z-50 bg-card md:relative md:w-72 md:min-h-screen flex flex-col transform transition-transform duration-300 ease-in-out md:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 border-b border-border hidden md:flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-text">Voice заметки</h1>
            <p className="text-xs text-text-muted">Панель управления</p>
          </div>
        </div>

        <div className="flex-1 p-4 space-y-6 overflow-y-auto">
          {/* User Profile */}
          <div className="flex items-center space-x-3 p-3 rounded-xl bg-surface border border-border">
            {user.photoUrl ? (
              <img src={user.photoUrl} alt="" className="w-10 h-10 rounded-xl object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center text-sm font-bold">
                {user.firstName?.[0] || "U"}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text truncate">{user.firstName} {user.lastName}</p>
              <p className="text-xs text-text-muted truncate">@{user.username || user.telegramId}</p>
            </div>
            <button
              onClick={onLogout}
              className="p-2 rounded-lg text-text-secondary hover:text-danger hover:bg-danger-light transition-colors"
              title="Выйти"
            >
              <LogOut size={16} />
            </button>
          </div>

          {/* Main Navigation */}
          <nav className="space-y-1">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider px-3 mb-2">Фильтры</p>
            <button
              onClick={onSelectAll}
              className={cn(
                "w-full flex items-center space-x-3 px-3 py-2.5 text-sm rounded-xl transition-all",
                !selectedCategoryId && !showArchived
                  ? "bg-primary text-white shadow-sm shadow-primary/20"
                  : "text-text-secondary hover:bg-surface hover:text-text"
              )}
            >
              <Inbox size={18} />
              <span className="font-medium">Все заметки</span>
            </button>
            <button
              onClick={onSelectArchived}
              className={cn(
                "w-full flex items-center space-x-3 px-3 py-2.5 text-sm rounded-xl transition-all",
                showArchived
                  ? "bg-primary text-white shadow-sm shadow-primary/20"
                  : "text-text-secondary hover:bg-surface hover:text-text"
              )}
            >
              <Archive size={18} />
              <span className="font-medium">Архив</span>
            </button>
          </nav>

          {/* Categories */}
          <nav className="space-y-1">
            <div className="flex items-center justify-between px-3 mb-2">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Категории</p>
              <button
                onClick={onCreateCategory}
                className="p-1 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-all"
                title="Создать категорию"
              >
                <Plus size={14} />
              </button>
            </div>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => { onSelectCategory(cat.id); }}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-xl transition-all group",
                  selectedCategoryId === cat.id
                    ? "bg-primary text-white shadow-sm shadow-primary/20"
                    : "text-text-secondary hover:bg-surface hover:text-text"
                )}
              >
                <div className="flex items-center space-x-3">
                  <Hash size={16} className="opacity-70" />
                  <span className="font-medium">{cat.name}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-full",
                    selectedCategoryId === cat.id
                      ? "bg-white/20 text-white"
                      : "bg-surface-alt text-text-muted"
                  )}>
                    {cat._count.notes}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteCategory(cat.id, cat.name); }}
                    className={cn(
                      "p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all",
                      selectedCategoryId === cat.id
                        ? "hover:bg-white/20 text-white/70 hover:text-white"
                        : "hover:bg-danger-light text-text-muted hover:text-danger"
                    )}
                    title={`Удалить ${cat.name}`}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={onClose}
        />
      )}
    </>
  );
}