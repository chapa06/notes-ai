import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Clock, Archive, Trash2, Pencil } from "lucide-react";
import { formatDate } from "../lib/utils";
import type { Note, Category } from "../types";

interface NoteCardProps {
  note: Note;
  categories: Category[];
  editingTopicId: string | null;
  changingCategoryId: string | null;
  expandedNoteId: string | null;
  onToggleArchive: (id: string, currentStatus: boolean) => void;
  onDelete: (id: string) => void;
  onSaveTopic: (id: string, topic: string) => Promise<void>;
  onStartEditTopic: (id: string) => void;
  onCancelEditTopic: () => void;
  onChangeCategory: (id: string, categoryId: string | null) => Promise<void>;
  onChangeCategoryStart: (id: string) => void;
  onChangeCategoryEnd: () => void;
  onToggleExpand: (id: string) => void;
}

export function NoteCard({
  note, categories, editingTopicId, changingCategoryId, expandedNoteId,
  onToggleArchive, onDelete, onSaveTopic, onStartEditTopic, onCancelEditTopic,
  onChangeCategory, onChangeCategoryStart, onChangeCategoryEnd, onToggleExpand,
}: NoteCardProps) {
  const [topicValue, setTopicValue] = useState(note.topic || "");
  const topicInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTopicId === note.id) {
      setTopicValue(note.topic || "");
      setTimeout(() => topicInputRef.current?.focus(), 50);
    }
  }, [editingTopicId, note.id, note.topic]);

  const handleSave = async () => {
    await onSaveTopic(note.id, topicValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") onCancelEditTopic();
  };

  const isEditing = editingTopicId === note.id;

  return (
    <motion.div
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
            {changingCategoryId === note.id ? (
              <select
                value={note.category?.id || ""}
                onChange={(e) => onChangeCategory(note.id, e.target.value || null)}
                onBlur={onChangeCategoryEnd}
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
                onClick={() => onChangeCategoryStart(note.id)}
              >
                {note.category?.name || "Без категории"}
              </span>
            )}
            <span className="flex items-center text-xs text-text-muted">
              <Clock size={12} className="mr-1" />
              {formatDate(note.createdAt)}
            </span>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => onToggleArchive(note.id, note.isArchived)}
              className="p-2 rounded-lg text-text-secondary hover:bg-primary/10 hover:text-primary transition-all"
              title={note.isArchived ? "Восстановить" : "Архивировать"}
            >
              <Archive size={15} className={note.isArchived ? "text-primary" : ""} />
            </button>
            <button
              onClick={() => onDelete(note.id)}
              className="p-2 rounded-lg text-text-secondary hover:bg-danger-light hover:text-danger transition-all"
              title="Удалить"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {/* Topic */}
        {isEditing ? (
          <div className="mb-3 flex items-center space-x-2">
            <input
              ref={topicInputRef}
              type="text"
              value={topicValue}
              onChange={(e) => setTopicValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 px-3 py-1.5 bg-surface border border-border rounded-lg text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <button
              onClick={handleSave}
              className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary-hover transition-all"
            >
              Сохр
            </button>
            <button
              onClick={onCancelEditTopic}
              className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-text-secondary hover:bg-surface transition-all"
            >
              Отм
            </button>
          </div>
        ) : (
          <div
            className="group flex items-center space-x-2 mb-3 cursor-pointer"
            onClick={() => {
              setTopicValue(note.topic || "");
          onStartEditTopic(note.id);
            }}
          >
            <h3 className="text-base font-bold text-text tracking-tight">
              {note.topic ? `📌 ${note.topic}` : "🎤 Голосовая заметка"}
            </h3>
            <Pencil size={14} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        )}

        {/* Summary */}
        {note.summary && (
          <div className="mb-3 p-3 rounded-xl bg-primary/5 border border-primary/10 text-sm text-text-secondary leading-relaxed">
            💡 {note.summary}
          </div>
        )}

        {/* Expand button */}
        {note.summary && (
          <button
            onClick={() => onToggleExpand(note.id)}
            className="mb-3 text-xs font-medium text-primary hover:text-primary-hover transition-colors"
          >
            {expandedNoteId === note.id ? "⬆️ Скрыть полный текст" : "⬇️ Развернуть полную заметку"}
          </button>
        )}

        {/* Full text */}
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
  );
}