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
├── server/                      # Серверная часть (Express + MongoDB + Mongoose + JWT)
│   ├── index.ts                 # Точка входа (Express + Vite middleware в dev)
│   ├── config.ts                # Конфигурация (env, константы)
│   ├── types.ts                 # Типы TypeScript (JWT, Telegram auth, заметки)
│   ├── models/
│   │   ├── User.ts              # Mongoose модель пользователя (Telegram ID)
│   │   ├── Category.ts          # Mongoose модель категории
│   │   ├── Note.ts              # Mongoose модель заметки
│   │   └── helpers.ts           # getOrCreateUser
│   ├── middleware/
│   │   └── auth.ts              # JWT аутентификация (authenticateToken)
│   └── routes/
│       ├── auth.ts              # POST /api/auth/telegram (Telegram login)
│       ├── categories.ts        # CRUD категорий + публичный список для бота
│       ├── notes.ts             # CRUD заметок (список, обновление, удаление)
│       └── external.ts          # POST /api/external/notes (приём из бота)
├── src/                         # Фронтенд (React 19 + TypeScript + Vite)
│   ├── main.tsx                 # Точка входа
│   ├── App.tsx                  # Главный компонент
│   ├── index.css                # Стили (Tailwind CSS 4)
│   ├── types/index.ts           # Типы (TelegramUser и др.)
│   ├── contexts/
│   │   └── AuthContext.tsx      # Контекст авторизации (токен в localStorage)
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useCategories.ts
│   │   ├── useNotes.ts
│   │   └── useToast.ts
│   ├── components/
│   │   ├── LoadingScreen.tsx
│   │   ├── LoginScreen.tsx      # Вход через Telegram Login Widget
│   │   ├── MobileHeader.tsx
│   │   ├── Sidebar.tsx
│   │   ├── TopBar.tsx
│   │   ├── NoteCard.tsx
│   │   ├── CreateCategoryModal.tsx
│   │   ├── ToastContainer.tsx
│   │   ├── TelegramLoginButton.tsx
│   │   └── ErrorBoundary.tsx
│   └── lib/
│       ├── api.ts               # HTTP-клиент (fetch с Bearer-токеном)
│       └── utils.ts             # Утилиты (cn, formatDate)
├── telegram-bot/                # Telegram-бот (Python)
│   ├── bot.py                   # Оркестратор (голосовые и аудиофайлы)
│   ├── config.py                # Конфигурация из .env
│   ├── transcriber.py           # Whisper транскрибация + VAD + FFmpeg
│   ├── analyzer.py              # Ollama AI-анализ (тема, summary, категория)
│   ├── sender.py                # Отправка заметок на сервер с локальным fallback
│   └── requirements.txt
├── scripts/                     # Вспомогательные скрипты
│   ├── seed.ts                  # Сидинг категорий в PostgreSQL (pg)
│   └── test-ingestion.ts
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
└── .env                         # локальный (в .gitignore, не в репозитории)
```

> Папки `dist/`, `node_modules/`, `.venv/`, `downloads/`, `transcriptions/`, `docker/`, `%temp%` и сам `.env` находятся в `.gitignore` и не отслеживаются Git.

---

## Сервер (server/)

Express-сервер на TypeScript с MongoDB (Mongoose). Реализует REST API для заметок, категорий и Telegram-аутентификации. В dev-режиме внутри сервера поднимается Vite middleware для фронтенда; в продакшене раздаёт собранную статику из `dist/`.

### API endpoints

| Метод | Путь | Описание | Auth |
|-------|------|----------|------|
| POST | `/api/auth/telegram` | Вход через Telegram (проверка хеша, выдача JWT) | — |
| GET | `/api/notes` | Список заметок пользователя (фильтр по категории, поиск, архив) | JWT |
| PATCH | `/api/notes/:id` | Обновление заметки (архив, категория, тема, summary) | JWT |
| DELETE | `/api/notes/:id` | Удаление заметки | JWT |
| GET | `/api/categories` | Список категорий с количеством заметок | JWT |
| POST | `/api/categories` | Создание категории | JWT |
| DELETE | `/api/categories/:id` | Удаление категории и её заметок | JWT |
| GET | `/api/public/categories` | Публичные категории (для Telegram-бота, по `telegramId`) | — |
| POST | `/api/external/notes` | Приём транскрибированной заметки из бота | API_KEY |

### Запуск

```bash
npm install
npm run dev       # Сервер (Express + Vite middleware) на http://localhost:3000
npm run build     # Сборка сервера (esbuild) и фронтенда (Vite) в dist/
npm start         # Запуск собранного сервера (node dist/server.js)
npm run seed      # Сидинг категорий в PostgreSQL (скрипт scripts/seed.ts)
npm run preview   # Предпросмотр собранного фронтенда (vite preview)
npm run clean     # Удаление dist/
npm run lint      # Проверка типов TypeScript (tsc --noEmit)
```

---

## Telegram-бот (telegram-bot/)

Бот на Python транскрибирует голосовые сообщения и аудиофайлы через локальную модель Whisper, анализирует текст через Ollama и отправляет готовую заметку на веб-сервер.

### Возможности

- Транскрибация голосовых сообщений и аудиофайлов Telegram через локальный Whisper (CPU / CUDA / MPS)
- Обработка аудиофайлов любых форматов (конвертация в WAV через FFmpeg)
- VAD-фильтр (вырезание тишины через WebRTC VAD)
- AI-анализ через Ollama: выделение темы, краткого содержания, подбор категории
- Fallback-анализ без Ollama (простое извлечение темы и summary)
- Автоматическая отправка на сервер Notes AI (`/api/external/notes`)
- Резервное локальное сохранение в `transcriptions/` при ошибках отправки
- Поддержка русского языка

### Требования

- Python 3.10+
- Telegram Bot Token (от @BotFather)
- FFmpeg (обязательно, для конвертации аудио)
- Ollama (локально, для AI-анализа; опционально, есть fallback)
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

### Конфигурация (.env в telegram-bot/)

| Переменная | Описание | По умолчанию |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Токен от @BotFather (обязательно) | — |
| `API_URL` | URL сервера API для отправки транскрибаций | `http://localhost:3000/api` |
| `API_KEY` | Ключ для авторизации на `/api/external/notes` (Bearer) | — |
| `USER_TOKEN` | Дополнительный пользовательский токен | — |
| `OLLAMA_BASE_URL` | Адрес локальной Ollama | `http://localhost:11434` |
| `OLLAMA_MODEL` | Модель Ollama для анализа | `qwen2.5:1.5b` |
| `WHISPER_MODEL_SIZE` | Размер модели Whisper (`tiny`, `base`, `small`, `medium`, `large`) | `base` |
| `ADMIN_USER_ID` | Telegram ID для уведомлений о запуске бота (опционально) | — |

---

## Фронтенд (src/)

React SPA на Vite с Tailwind CSS 4. Аутентификация через Telegram Login Widget (бот `@vvoddaleshebot`), состояние сессии хранится в `localStorage`.

### Особенности реализации

- `AuthContext` для единого состояния авторизации (пользователь + JWT-токен)
- Кастомные хуки (`useNotes`, `useCategories`, `useToast`) для изоляции логики
- Разделение UI на переиспользуемые компоненты
- Анимации через `motion` (Framer Motion)
- Иконки через `lucide-react`
- Типизация через TypeScript (без `any`)
- Обработка ошибок через `ErrorBoundary`

---

## Технологии

- **Сервер:** Node.js, TypeScript, Express, MongoDB (Mongoose), JWT
- **Фронтенд:** React 19, TypeScript, Tailwind CSS 4, Vite, motion, lucide-react
- **Бот:** Python, python-telegram-bot, openai-whisper, FFmpeg, WebRTC VAD, Ollama
- **AI:** Whisper (транскрибация), Ollama / qwen2.5 (анализ текста)
- **Прочее:** `@google/genai` установлен в зависимостях (пробрасывается через `vite.config.ts`), но не используется в исходном коде; `pg` используется только скриптом `scripts/seed.ts` для сидинга категорий в PostgreSQL.

---

## Быстрый старт

1. **База данных** — разверните MongoDB (локально или через `docker-compose.yml` — файл существует в репозитории, но добавлен в `.gitignore`, так что нужно скопировать его вручную):
   ```bash
   docker compose up -d   # только MongoDB
   ```
2. **Сервер:**
   ```bash
   npm install
   npm run dev
   ```
3. **Telegram-бот:**
   ```bash
   cd telegram-bot
   python -m venv venv && venv\Scripts\activate
   pip install -r requirements.txt
   python bot.py
   ```
4. **Фронтенд** доступен автоматически через сервер на `http://localhost:3000`.

---

## Переменные окружения

В репозитории нет файла `.env.example`. Ниже — шаблон, который нужно скопировать в `.env` в корне проекта и заполнить своими значениями. **Не публикуйте реальные токены и ключи в открытом репозитории.**

```env
# Сервер
MONGODB_URI="mongodb://localhost:27017/notes_hub"
JWT_SECRET="your_jwt_secret"
TELEGRAM_BOT_TOKEN="your_bot_token"
PORT=3000
NODE_ENV=development

# Фронтенд (пробрасывается в Vite)
VITE_TELEGRAM_BOT_NAME="your_bot_username"
GEMINI_API_KEY="your_gemini_key"

# Telegram-бот (в telegram-bot/.env)
TELEGRAM_BOT_TOKEN="your_bot_token"
API_URL="http://localhost:3000/api"
API_KEY="your_external_api_key"
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="qwen2.5:1.5b"
WHISPER_MODEL_SIZE="base"
ADMIN_USER_ID=""
```

Примечание: в текущем `.gitignore` игнорируются все `.env*` файлы, кроме `.env.example` (которого пока нет в репозитории).