import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Search, 
  Hash, 
  Archive, 
  Trash2, 
  LogOut, 
  ExternalLink, 
  FolderOpen,
  Inbox,
  Clock,
  Menu,
  X,
  Sparkles,
  ChevronRight,
  Tag,
  Plus,
  Settings,
  Pencil
} from "lucide-react";
import { TelegramLoginButton } from "./components/TelegramLoginButton";
import { apiRequest } from "./lib/api";
import { cn, formatDate } from "./lib/utils";

interface User {
  id: string;
  telegramId: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
}

interface Category {
  id: string;
  name: string;
  _count: {
    notes: number;
  };
}

interface Note {
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
  };
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("notes_hub_token"));
  const [categories, setCategories] = useState<Category[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; message: string; type: "success" | "error" }[]>([]);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editingTopicValue, setEditingTopicValue] = useState("");
  const [changingCategoryId, setChangingCategoryId] = useState<string | null>(null);
  const newCatInputRef = useRef<HTMLInputElement>(null);
  const topicInputRef = useRef<HTMLInputElement>(null);

  const addToast = (message: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  useEffect(() => {
    const savedUser = localStorage.getItem("notes_hub_user");
    if (savedUser && token) {
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchCategories();
      fetchNotes();
    }
  }, [token, selectedCategoryId, searchQuery, showArchived]);

  const fetchCategories = async () => {
    try {
      const data = await apiRequest("/categories");
      setCategories(data);
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    }
  };

  const fetchNotes = async () => {
    const params = new URLSearchParams();
    if (selectedCategoryId) params.append("categoryId", selectedCategoryId);
    if (searchQuery) params.append("search", searchQuery);
    if (showArchived) params.append("archived", "true");

    try {
      const data = await apiRequest(`/notes?${params.toString()}`);
      setNotes(data);
    } catch (error) {
      console.error("Failed to fetch notes:", error);
    }
  };

  const handleTelegramAuth = async (telegramUser: any) => {
    try {
      const { token, user } = await apiRequest("/auth/telegram", {
        method: "POST",
        body: JSON.stringify(telegramUser),
      });
      localStorage.setItem("notes_hub_token", token);
      localStorage.setItem("notes_hub_user", JSON.stringify(user));
      setToken(token);
      setUser(user);
      addToast("✅ Авторизация прошла успешно");
    } catch (error) {
      console.error("Auth failed:", error);
      addToast("❌ Ошибка авторизации", "error");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("notes_hub_token");
    localStorage.removeItem("notes_hub_user");
    setToken(null);
    setUser(null);
    addToast("✅ Сессия завершена");
  };

  const toggleArchive = async (noteId: string, currentStatus: boolean) => {
    try {
      await apiRequest(`/notes/${noteId}`, {
        method: "PATCH",
        body: JSON.stringify({ isArchived: !currentStatus }),
      });
      fetchNotes();
      fetchCategories();
      addToast(currentStatus ? "✅ Заметка восстановлена" : "✅ Заметка архивирована");
    } catch (error) {
      console.error("Failed to update note:", error);
      addToast("❌ Ошибка обновления", "error");
    }
  };

  const updateTopic = async (noteId: string, newTopic: string) => {
    try {
      await apiRequest(`/notes/${noteId}`, {
        method: "PATCH",
        body: JSON.stringify({ topic: newTopic }),
      });
      setEditingTopicId(null);
      fetchNotes();
      addToast("✅ Тема обновлена");
    } catch (error) {
      console.error("Failed to update topic:", error);
      addToast("❌ Ошибка обновления темы", "error");
    }
  };

  const changeCategory = async (noteId: string, newCategoryId: string | null) => {
    try {
      await apiRequest(`/notes/${noteId}`, {
        method: "PATCH",
        body: JSON.stringify({ categoryId: newCategoryId }),
      });
      setChangingCategoryId(null);
      fetchNotes();
      fetchCategories();
      addToast("✅ Категория изменена");
    } catch (error) {
      console.error("Failed to change category:", error);
      addToast("❌ Ошибка изменения категории", "error");
    }
  };

  const deleteNote = async (noteId: string) => {
    if (!confirm("Вы уверены что хотите удалить эту заметку?")) return;
    try {
      await apiRequest(`/notes/${noteId}`, { method: "DELETE" });
      fetchNotes();
      fetchCategories();
      addToast("✅ Заметка удалена");
    } catch (error) {
      console.error("Failed to delete note:", error);
      addToast("❌ Ошибка удаления", "error");
    }
  };

  const createCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    try {
      await apiRequest("/categories", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setNewCategoryName("");
      setIsCreateCategoryOpen(false);
      fetchCategories();
      addToast(`✅ Категория "${name}" создана`);
    } catch (error) {
      console.error("Failed to create category:", error);
      addToast("❌ Ошибка создания категории", "error");
    }
  };

  const deleteCategory = async (catId: string, catName: string) => {
    if (!confirm(`Удалить категорию "${catName}"? Заметки в этой категории останутся без категории.`)) return;
    try {
      await apiRequest(`/categories/${catId}`, { method: "DELETE" });
      fetchCategories();
      if (selectedCategoryId === catId) setSelectedCategoryId(null);
      addToast(`✅ Категория "${catName}" удалена`);
    } catch (error) {
      console.error("Failed to delete category:", error);
      addToast("❌ Ошибка удаления категории", "error");
    }
  };

  const startEditTopic = (noteId: string, currentTopic: string) => {
    setEditingTopicId(noteId);
    setEditingTopicValue(currentTopic);
    setTimeout(() => topicInputRef.current?.focus(), 100);
  };

  const saveEditTopic = () => {
    if (editingTopicId) {
      updateTopic(editingTopicId, editingTopicValue);
    }
  };

  const cancelEditTopic = () => {
    setEditingTopicId(null);
    setEditingTopicValue("");
  };

  // Focus input when create modal opens
  useEffect(() => {
    if (isCreateCategoryOpen && newCatInputRef.current) {
      setTimeout(() => newCatInputRef.current?.focus(), 100);
    }
  }, [isCreateCategoryOpen]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-text-secondary font-medium">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-surface to-surface-alt flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="bg-card rounded-2xl shadow-xl shadow-black/5 border border-border p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-text">Voice заметки</h1>
              <p className="text-sm text-text-secondary mt-1">Голосовые заметки с AI анализом</p>
            </div>
            
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                <p className="text-sm text-text-secondary leading-relaxed">
                  Войдите через Telegram, чтобы просматривать и управлять вашими голосовыми заметками.
                </p>
              </div>
            
              <div>
                <TelegramLoginButton 
                  botName="vvoddaleshebot"
                  onAuth={handleTelegramAuth}
                />
              </div>
            </div>
            
            <div className="mt-8 pt-6 border-t border-border text-center">
              <p className="text-xs text-text-muted">Защищенное соединение • Voice заметки v1.0</p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-text flex flex-col md:flex-row overflow-hidden">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-card border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <h1 className="font-bold text-text">Voice заметки</h1>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 rounded-lg hover:bg-surface transition-colors"
        >
          {isSidebarOpen ? <X size={20} className="text-text" /> : <Menu size={20} className="text-text" />}
        </button>
      </div>

      {/* Sidebar */}
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
              onClick={handleLogout} 
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
              onClick={() => { setSelectedCategoryId(null); setShowArchived(false); setIsSidebarOpen(false); }}
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
              onClick={() => { setShowArchived(true); setSelectedCategoryId(null); setIsSidebarOpen(false); }}
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
                onClick={() => setIsCreateCategoryOpen(true)}
                className="p-1 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-all"
                title="Создать категорию"
              >
                <Plus size={14} />
              </button>
            </div>
            {categories.map((cat) => (
              <button 
                key={cat.id}
                onClick={() => { setSelectedCategoryId(cat.id); setShowArchived(false); setIsSidebarOpen(false); }}
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
                    onClick={(e) => { e.stopPropagation(); deleteCategory(cat.id, cat.name); }}
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

      {/* Sidebar overlay for mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-surface">
        {/* Top Bar */}
        <header className="bg-card border-b border-border">
          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
              <input 
                type="text" 
                placeholder="Поиск заметок..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-xl text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-text-muted hidden sm:block">
                <span className="font-semibold text-text">{notes.length}</span> заметок
              </div>
              <div className="h-5 w-px bg-border hidden sm:block" />
              <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-surface text-sm text-text-secondary">
                <Tag size={14} />
                <span className="font-medium">
                  {showArchived ? "Архив" : selectedCategoryId ? categories.find(c => c.id === selectedCategoryId)?.name : "Все заметки"}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Notes Grid */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-4xl mx-auto space-y-4">
            <AnimatePresence mode="popLayout">
              {notes.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-24 text-center"
                >
                  <div className="w-20 h-20 rounded-2xl bg-surface-alt flex items-center justify-center mb-4">
                    <FolderOpen size={36} className="text-text-muted" strokeWidth={1.5} />
                  </div>
                  <p className="text-lg font-semibold text-text">Заметки не найдены</p>
                  <p className="text-sm text-text-muted mt-1">В выбранном разделе пока нет заметок</p>
                </motion.div>
              ) : (
                notes.map((note) => (
                  <motion.div
                    key={note.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                    className="bg-card rounded-2xl border border-border shadow-sm hover:shadow-md hover:border-border-hover transition-all"
                  >
                    <div className="p-5">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          {/* Категория — кликабельна для смены */}
                          {changingCategoryId === note.id ? (
                            <select
                              value={note.category?.id || ""}
                              onChange={(e) => {
                                const val = e.target.value || null;
                                changeCategory(note.id, val);
                              }}
                              onBlur={() => setChangingCategoryId(null)}
                              autoFocus
                              className="px-2 py-1 rounded-lg bg-surface border border-border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
                            >
                              <option value="">Без категории</option>
                              {categories.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          ) : (
                            <span 
                              className="inline-flex items-center px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-semibold cursor-pointer hover:bg-primary/20 transition-all"
                              onClick={() => setChangingCategoryId(note.id)}
                            >
                              {note.category.name}
                            </span>
                          )}
                          <span className="flex items-center text-xs text-text-muted">
                            <Clock size={12} className="mr-1" />
                            {formatDate(note.createdAt)}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <button 
                            onClick={() => toggleArchive(note.id, note.isArchived)}
                            className="p-2 rounded-lg text-text-secondary hover:bg-primary/10 hover:text-primary transition-all"
                            title={note.isArchived ? "Восстановить" : "Архивировать"}
                          >
                            <Archive size={15} className={note.isArchived ? "text-primary" : ""} />
                          </button>
                          <button 
                            onClick={() => deleteNote(note.id)}
                            className="p-2 rounded-lg text-text-secondary hover:bg-danger-light hover:text-danger transition-all"
                            title="Удалить"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                      
                      {/* Тема заметки — редактируемая */}
                      {editingTopicId === note.id ? (
                        <div className="mb-3 flex items-center space-x-2">
                          <input
                            ref={topicInputRef}
                            type="text"
                            value={editingTopicValue}
                            onChange={(e) => setEditingTopicValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEditTopic();
                              if (e.key === "Escape") cancelEditTopic();
                            }}
                            className="flex-1 px-3 py-1.5 bg-surface border border-border rounded-lg text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          />
                          <button
                            onClick={saveEditTopic}
                            className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary-hover transition-all"
                          >
                            Сохр
                          </button>
                          <button
                            onClick={cancelEditTopic}
                            className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-text-secondary hover:bg-surface transition-all"
                          >
                            Отм
                          </button>
                        </div>
                      ) : (
                        <div 
                          className="group flex items-center space-x-2 mb-3 cursor-pointer"
                          onClick={() => startEditTopic(note.id, note.topic || "")}
                        >
                          <h3 className="text-base font-bold text-text tracking-tight">
                            {note.topic ? `📌 ${note.topic}` : "🎤 Голосовая заметка"}
                          </h3>
                          <Pencil size={14} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      )}

                      {/* Краткое содержание */}
                      {note.summary && (
                        <div className="mb-3 p-3 rounded-xl bg-primary/5 border border-primary/10 text-sm text-text-secondary leading-relaxed">
                          💡 {note.summary}
                        </div>
                      )}

                      {/* Кнопка развернуть */}
                      {note.summary && (
                        <button 
                          onClick={() => setExpandedNoteId(expandedNoteId === note.id ? null : note.id)}
                          className="mb-3 text-xs font-medium text-primary hover:text-primary-hover transition-colors"
                        >
                          {expandedNoteId === note.id ? "⬆️ Скрыть полный текст" : "⬇️ Развернуть полную заметку"}
                        </button>
                      )}

                      {/* Полный текст заметки */}
                      <AnimatePresence>
                        {(!note.summary || expandedNoteId === note.id) && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="text-sm text-text leading-relaxed whitespace-pre-wrap overflow-hidden"
                          >
                            {note.content}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Create Category Modal */}
      <AnimatePresence>
        {isCreateCategoryOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          >
            <div 
              className="absolute inset-0 bg-black/30 backdrop-blur-sm"
              onClick={() => { setIsCreateCategoryOpen(false); setNewCategoryName(""); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15 }}
              className="relative bg-card rounded-2xl border border-border shadow-2xl w-full max-w-sm p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-text">Новая категория</h2>
                <button
                  onClick={() => { setIsCreateCategoryOpen(false); setNewCategoryName(""); }}
                  className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface transition-all"
                >
                  <X size={18} />
                </button>
              </div>
              <form
                onSubmit={(e) => { e.preventDefault(); createCategory(); }}
                className="space-y-4"
              >
                <input
                  ref={newCatInputRef}
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Название категории"
                  className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => { setIsCreateCategoryOpen(false); setNewCategoryName(""); }}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-surface transition-all"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={!newCategoryName.trim()}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Создать
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 z-[100] space-y-2">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, x: 20 }}
              animate={{ opacity: 1, y: 0, x: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn(
                "px-4 py-3 rounded-xl border shadow-lg text-sm font-medium",
                toast.type === "success" 
                  ? "bg-card border-border text-text" 
                  : "bg-danger text-white border-danger"
              )}
            >
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}