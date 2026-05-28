import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import type { Toast } from "../types";

interface ToastContainerProps {
  toasts: Toast[];
}

export function ToastContainer({ toasts }: ToastContainerProps) {
  return (
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
  );
}