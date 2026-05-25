import React, { useEffect } from "react";

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface TelegramLoginButtonProps {
  botName: string;
  onAuth: (user: TelegramUser) => void;
  buttonSize?: "large" | "medium" | "small";
  cornerRadius?: number;
  requestAccess?: "write" | "read";
  showUserPhoto?: boolean;
}

declare global {
  interface Window {
    onTelegramAuth: (user: TelegramUser) => void;
  }
}

export const TelegramLoginButton: React.FC<TelegramLoginButtonProps> = ({
  botName,
  onAuth,
  buttonSize = "large",
  cornerRadius = 8,
  requestAccess = "write",
  showUserPhoto = true,
}) => {
  useEffect(() => {
    // Глобальная функция для Telegram
    window.onTelegramAuth = onAuth;

    const container = document.getElementById("telegram-login-container");
    if (!container) return;

    // Очистка перед вставкой
    container.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", "vvoddaleshebot");
    script.setAttribute("data-size", buttonSize);
    script.setAttribute("data-radius", cornerRadius.toString());
    script.setAttribute("data-request-access", requestAccess);
    script.setAttribute("data-userpic", showUserPhoto.toString());
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.async = true;

    container.appendChild(script);
  }, [botName, onAuth, buttonSize, cornerRadius, requestAccess, showUserPhoto]);

  return <div id="telegram-login-container" className="flex justify-center" />;
};