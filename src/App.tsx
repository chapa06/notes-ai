import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FolderOpen } from "lucide-react";
import { useAuth } from "./contexts/AuthContext";
import { useCategories } from "./hooks/useCategories";
import { useNotes } from "./hooks/useNotes";
import { useToast } from "./hooks/useToast";
import { LoadingScreen } from "./components/LoadingScreen";
import { LoginScreen } from "./components/LoginScreen";
import { MobileHeader } from "./components/MobileHeader";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { NoteCard } from "./components/NoteCard";
import { CreateCategoryModal } from "./components/CreateCategoryModal";
import { ToastContainer } from "./components/ToastContainer";
import type { TelegramUser } from "./types";

export default function App() {
  const { user, token, isLoading, login, logout } = useAuth();
  const { categories, fetchCategories, createCategory, deleteCategory } = useCategories();
  const { notes, setNotes, fetchNotes, toggleArchive, updateTopic, changeCategory, deleteNote } = useNotes();
  const { toasts, addToast } = useToast();

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [changingCategoryId, setChangingCategoryId] = useState<string | null>(null);

  // Fetch data on auth state change
  useEffect(() => {
    if (token) {
      fetchCategories();
      fetchNotes({ categoryId: selectedCategoryId, searchQuery, showArchived });
    }
  }, [token, selectedCategoryId, searchQuery, showArchived, fetchCategories, fetchNotes]);

  const handleTelegramAuth = useCallback(async (telegramUser: TelegramUser) => {
    try {
      await login(telegramUser);
      addToast("✅ Авторизация прошла успешно");
    } catch (error) {
      console.error("Auth failed:", error);
      addToast("❌ Ошибка авторизации", "error");
    }
  }, [login, addToast]);

  const handleLogout = useCallback(() => {
    logout();
    setSelectedCategoryId(null);
    setShowArchived(false);
    setNotes([]);
    addToast("✅ Сессия завершена");
  }, [logout, setNotes, addToast]);

  const handleToggleArchive = useCallback(async (noteId: string, currentStatus: boolean) => {
    try {
      await toggleArchive(noteId, currentStatus);
      await fetchNotes({ categoryId: selectedCategoryId, searchQuery, showArchived });
      await fetchCategories();
      addToast(currentStatus ? "✅ Заметка восстановлена" : "✅ Заметка архивирована");
    } catch {
      addToast("❌ Ошибка обновления", "error");
    }
  }, [toggleArchive, fetchNotes, fetchCategories, selectedCategoryId, searchQuery, showArchived, addToast]);

  const handleUpdateTopic = useCallback(async (noteId: string, topic: string) => {
    try {
      await updateTopic(noteId, topic);
      setEditingTopicId(null);
      await fetchNotes({ categoryId: selectedCategoryId, searchQuery, showArchived });
      addToast("✅ Тема обновлена");
    } catch {
      addToast("❌ Ошибка обновления темы", "error");
    }
  }, [updateTopic, fetchNotes, selectedCategoryId, searchQuery, showArchived, addToast]);

  const handleChangeCategory = useCallback(async (noteId: string, newCategoryId: string | null) => {
    try {
      await changeCategory(noteId, newCategoryId);
      setChangingCategoryId(null);
      await fetchNotes({ categoryId: selectedCategoryId, searchQuery, showArchived });
      await fetchCategories();
      addToast("✅ Категория изменена");
    } catch {
      addToast("❌ Ошибка изменения категории", "error");
    }
  }, [changeCategory, fetchNotes, fetchCategories, selectedCategoryId, searchQuery, showArchived, addToast]);

  const handleDeleteNote = useCallback(async (noteId: string) => {
    if (!confirm("Вы уверены что хотите удалить эту заметку?")) return;
    try {
      await deleteNote(noteId);
      await fetchNotes({ categoryId: selectedCategoryId, searchQuery, showArchived });
      await fetchCategories();
      addToast("✅ Заметка удалена");
    } catch {
      addToast("❌ Ошибка удаления", "error");
    }
  }, [deleteNote, fetchNotes, fetchCategories, selectedCategoryId, searchQuery, showArchived, addToast]);

  const handleCreateCategory = useCallback(async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    try {
      await createCategory(name);
      setNewCategoryName("");
      setIsCreateCategoryOpen(false);
      addToast(`✅ Категория "${name}" создана`);
    } catch {
      addToast("❌ Ошибка создания категории", "error");
    }
  }, [newCategoryName, createCategory, addToast]);

  const handleDeleteCategory = useCallback(async (catId: string, catName: string) => {
    if (!confirm(`Удалить категорию "${catName}"? Заметки в этой категории останутся без категории.`)) return;
    try {
      await deleteCategory(catId);
      if (selectedCategoryId === catId) setSelectedCategoryId(null);
      addToast(`✅ Категория "${catName}" удалена`);
    } catch {
      addToast("❌ Ошибка удаления категории", "error");
    }
  }, [deleteCategory, selectedCategoryId, addToast]);

  const handleSelectAll = useCallback(() => {
    setSelectedCategoryId(null);
    setShowArchived(false);
    setIsSidebarOpen(false);
  }, []);

  const handleSelectArchived = useCallback(() => {
    setShowArchived(true);
    setSelectedCategoryId(null);
    setIsSidebarOpen(false);
  }, []);

  const handleSelectCategory = useCallback((id: string) => {
    setSelectedCategoryId(id);
    setShowArchived(false);
    setIsSidebarOpen(false);
  }, []);

  if (isLoading) return <LoadingScreen />;
  if (!user) return <LoginScreen onAuth={handleTelegramAuth} />;

  return (
    <div className="min-h-screen bg-surface text-text flex flex-col md:flex-row overflow-hidden">
      <MobileHeader
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
      />

      <Sidebar
        user={user}
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        showArchived={showArchived}
        isSidebarOpen={isSidebarOpen}
        onSelectAll={handleSelectAll}
        onSelectArchived={handleSelectArchived}
        onSelectCategory={handleSelectCategory}
        onCreateCategory={() => setIsCreateCategoryOpen(true)}
        onDeleteCategory={handleDeleteCategory}
        onLogout={handleLogout}
        onClose={() => setIsSidebarOpen(false)}
      />

      <main className="flex-1 flex flex-col min-w-0 bg-surface">
        <TopBar
          searchQuery={searchQuery}
          notesCount={notes.length}
          selectedCategoryId={selectedCategoryId}
          showArchived={showArchived}
          categories={categories}
          onSearchChange={setSearchQuery}
        />

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
                  <NoteCard
                    key={note.id}
                    note={note}
                    categories={categories}
                    editingTopicId={editingTopicId}
                    changingCategoryId={changingCategoryId}
                    expandedNoteId={expandedNoteId}
                    onToggleArchive={handleToggleArchive}
                    onDelete={handleDeleteNote}
                    onSaveTopic={handleUpdateTopic}
                    onStartEditTopic={(id) => setEditingTopicId(id)}
                    onCancelEditTopic={() => setEditingTopicId(null)}
                    onChangeCategory={handleChangeCategory}
                    onChangeCategoryStart={(id) => setChangingCategoryId(id)}
                    onChangeCategoryEnd={() => setChangingCategoryId(null)}
                    onToggleExpand={(id) => setExpandedNoteId(prev => prev === id ? null : id)}
                  />
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      <CreateCategoryModal
        isOpen={isCreateCategoryOpen}
        value={newCategoryName}
        onChange={setNewCategoryName}
        onSubmit={handleCreateCategory}
        onClose={() => { setIsCreateCategoryOpen(false); setNewCategoryName(""); }}
      />

      <ToastContainer toasts={toasts} />
    </div>
  );
}