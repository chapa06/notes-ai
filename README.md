# Notes AI

Система голосовых заметок с веб-интерфейсом, Telegram-ботом для транскрибации и AI-анализом.

---

## Автор

**Чаплюк Егор Александрович**

- Группа: КБ-231
- 3 курс / 6 семестр
- Направление: Кибербезопасность
- Вид проекта: курсовая работа

---

## Структура проекта

```
notes-ai/
├── server/                      # Серверная часть (Express + MongoDB)
│   ├── index.ts                 # Точка входа
│   ├── config.ts                # Конфигурация (env, константы)
│   ├── types.ts                 # Типы TypeScript
│   ├── models/                  # Mongoose модели
│   │   ├── User.ts
│   │   ├── Category.ts
│   │   ├── Note.ts
│   │   └── helpers.ts
│   ├── middleware/
│   │   └── auth.ts              # JWT аутентификация
│   └── routes/
│       ├── auth.ts              # Telegram auth
│       ├── categories.ts        # CRUD категорий
│       ├── notes.ts             # CRUD заметок
│       └── external.ts          # API для Telegram-бота
├── src/                         # Фронтенд (React + Vite)
│   ├── main.tsx                 # Точка входа
│   ├── App.tsx                  # Главный компонент
│   ├── index.css                # Стили (Tailwind)
│   ├── types/index.ts           # Типы
│   ├── contexts/
│   │   └── AuthContext.tsx       # Контекст авторизации
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useCategories.ts
│   │   ├── useNotes.ts
│   │   └── useToast.ts
│   ├── components/
│   │   ├── LoadingScreen.tsx
│   │   ├── LoginScreen.tsx
│   │   ├── MobileHeader.tsx
│   │   ├── Sidebar.tsx
│   │   ├── TopBar.tsx
│   │   ├── NoteCard.tsx
│   │   ├── CreateCategoryModal.tsx
│   │   ├── ToastContainer.tsx
│   │   ├── TelegramLoginButton.tsx
│   │   └── ErrorBoundary.tsx
│   └── lib/
│       ├── api.ts               # HTTP-клиент
│       └── utils.ts             # Утилиты (cn, formatDate)
├── telegram-bot/                # Telegram-бот (Python)
│   ├── bot.py                   # Оркестратор
│   ├── config.py                # Конфигурация
│   ├── transcriber.py           # Whisper транскрибация + VAD
│   ├── analyzer.py              # Ollama AI анализ
│   ├── sender.py                # Отправка на сайт
│   └── requirements.txt
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
└── .gitignore
```

---

## Сервер (server/)

Express-сервер с MongoDB (Mongoose). Реализует REST API для заметок, категорий и Telegram-аутентификации.

### API endpoints

| Метод | Путь | Описание |
|-------|------|----------|
| POST | /api/auth/telegram | Вход через Telegram |
| GET | /api/notes | Список заметок |
| PATCH | /api/notes/:id | Обновление заметки |
| DELETE | /api/notes/:id | Удаление заметки |
| GET | /api/categories | Список категорий |
| POST | /api/categories | Создание категории |
| DELETE | /api/categories/:id | Удаление категории |
| GET | /api/public/categories | Публичные категории |
| POST | /api/external/notes | Приём заметок из бота |

### Запуск

```bash
npm install
npm run dev       # Режим разработки (Vite + сервер)
npm run build     # Сборка для продакшена
npm start         # Запуск собранного сервера
```

---

## Telegram-бот (telegram-bot/)

Бот транскрибирует голосовые сообщения и аудиофайлы через локальную модель Whisper, анализирует через Ollama и отправляет заметки на сервер.

### Возможности

- Транскрибация голосовых сообщений Telegram через локальный Whisper (GPU/CPU)
- Обработка аудиофайлов любых форматов (через FFmpeg)
- VAD-фильтр (вырезание тишины через WebRTC VAD)
- AI-анализ через Ollama: выделение темы, краткого содержания, подбор категории
- Автоматическая отправка на сервер Notes AI
- Резервное локальное сохранение при ошибках отправки
- Поддержка русского языка

### Требования

- Python 3.10+
- Telegram Bot Token (от @BotFather)
- FFmpeg (обязательно)
- Ollama (локально, для AI-анализа)
- Видеокарта NVIDIA (CUDA) или Apple Silicon (MPS) для ускорения Whisper (опционально)

### Установка и запуск

```bash
cd telegram-bot
python -m venv venv
venv\Scripts\activate          # Windows
source venv/bin/activate       # Linux/Mac
pip install -r requirements.txt
python bot.py
```

### Конфигурация (.env)

| Переменная | Описание | По умолчанию |
|---|---|---|
| TELEGRAM_BOT_TOKEN | Токен от @BotFather (обязательно) | - |
| API_URL | URL сервера API | http://localhost:3000/api |
| API_KEY | Ключ авторизации для API | - |
| OLLAMA_BASE_URL | Адрес локальной Ollama | http://localhost:11434 |
| OLLAMA_MODEL | Модель Ollama для анализа | qwen2.5:1.5b |
| WHISPER_MODEL_SIZE | Размер модели: tiny, base, small, medium, large | base |
| ADMIN_USER_ID | Telegram ID для уведомлений | - |

---

## Фронтенд (src/)

React SPA на Vite с Tailwind CSS. Использует Telegram Login Widget для аутентификации.

### Особенности реализации

- Контекст AuthContext для единого состояния авторизации
- Кастомные хуки (useNotes, useCategories, useToast) для изоляции логики
- Разделение UI на переиспользуемые компоненты (SRP)
- Анимации через motion (Framer Motion)
- Типизация через TypeScript (без any)

---

## Технологии

- **Сервер:** Node.js, Express, MongoDB (Mongoose), JWT
- **Фронтенд:** React 19, TypeScript, Tailwind CSS 4, Vite, motion
- **Бот:** Python, python-telegram-bot, Whisper (openai-whisper), FFmpeg, Ollama
- **AI:** Whisper (транскрибация), Ollama / qwen2.5 (анализ текста)