import { motion } from "motion/react";
import { Sparkles } from "lucide-react";
import { TelegramLoginButton } from "./TelegramLoginButton";
import type { TelegramUser } from "../types";

interface LoginScreenProps {
  onAuth: (user: TelegramUser) => void;
}

export function LoginScreen({ onAuth }: LoginScreenProps) {
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
                onAuth={onAuth}
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