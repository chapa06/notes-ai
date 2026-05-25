"""
Telegram Bot для транскрибации голосовых сообщений и отправки на сайт
Использует локальную модель Whisper (GPU/CPU) с предзагрузкой,
VAD-фильтр для вырезания тишины.
Для анализа заметок используется локальная Ollama (порт 11434).
"""

import os
import sys
import re
import json
import time
import logging
import asyncio
import subprocess
import shutil
import functools

from telegram import Update
from telegram.ext import Application, MessageHandler, filters, ContextTypes
import requests
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)


class TranscriptionBot:
    _whisper_model = None
    _device = "cpu"
    _use_fp16 = False

    def __init__(self):
        self.bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
        self.api_url = os.getenv('API_URL', 'http://localhost:3000/api')
        self.api_key = os.getenv('API_KEY', '')
        self.user_token = os.getenv('USER_TOKEN', '')
        self.ollama_base_url = os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')
        self.ollama_model = os.getenv('OLLAMA_MODEL', 'qwen2.5:1.5b')

        # Кэш категорий с сервера (очень короткий — 30 секунд)
        self._categories_cache = {}
        self._categories_cache_ttl = 30  # 30 секунд

        # Множество известных telegram_id пользователей для фонового обновления
        self._known_telegram_ids = set()
        # Флаг для фонового обновления
        self._background_task_started = False

        if not self.bot_token:
            raise ValueError("TELEGRAM_BOT_TOKEN не найден в переменных окружения")

        # Проверяем наличие ffmpeg при старте
        self._ffmpeg_path = shutil.which("ffmpeg")
        if self._ffmpeg_path:
            logger.info(f"✅ FFmpeg найден: {self._ffmpeg_path}")
        else:
            logger.error("❌ FFmpeg НЕ НАЙДЕН! Транскрибация НЕ БУДЕТ РАБОТАТЬ!")
            logger.error("   Установите ffmpeg: winget install ffmpeg  или  chocolatey install ffmpeg")

        self.application = Application.builder() \
            .token(self.bot_token) \
            .connect_timeout(30) \
            .read_timeout(30) \
            .write_timeout(30) \
            .pool_timeout(30) \
            .build()

        self.application.add_handler(
            MessageHandler(filters.VOICE, self.handle_voice_message)
        )
        self.application.add_handler(
            MessageHandler(filters.AUDIO, self.handle_audio_file)
        )

        logger.info("Бот инициализирован")

    # ─── Получение списка категорий с сервера ────────────────────────────────

    def _fetch_categories(self, telegram_id: int = None) -> list:
        """Получает список категорий с сервера (кэш обновляется фоновой задачей каждые 15 секунд).
        Если передан telegram_id — только категории этого пользователя."""
        cache_key = telegram_id or 0
        cache_attr = f'_categories_cache_{cache_key}'

        cached = getattr(self, cache_attr, None)
        if cached is not None:
            return cached

        try:
            public_url = self.api_url.rstrip('/api').rstrip('/') + '/api/public/categories'
            if telegram_id:
                public_url += f'?telegramId={telegram_id}'

            resp = requests.get(public_url, timeout=5)
            if resp.status_code == 200:
                categories = resp.json()
                setattr(self, cache_attr, categories)
                logger.info(f"📂 Загружено {len(categories)} категорий для user {telegram_id}")
                return categories

            logger.warning(f"Не удалось загрузить категории: {resp.status_code}")
        except Exception as e:
            logger.warning(f"Ошибка загрузки категорий: {e}")

        logger.warning("⚠️ Не удалось загрузить категории с сервера, возвращаю пустой список")
        return []

    # ─── Предзагрузка Whisper при старте ──────────────────────────────────────

    def _preload_whisper(self):
        """Загружает модель Whisper один раз при старте (на class-level)."""
        if TranscriptionBot._whisper_model is not None:
            logger.info("Модель Whisper уже загружена, пропускаем")
            return

        import torch
        import whisper

        if torch.cuda.is_available():
            TranscriptionBot._device = "cuda"
            gpu_name = torch.cuda.get_device_name(0)
            logger.info(f"🔥 CUDA ({gpu_name}) — используем GPU")
        elif torch.backends.mps.is_available():
            TranscriptionBot._device = "mps"
            logger.info("🍎 MPS — используем Apple Metal GPU")
        else:
            TranscriptionBot._device = "cpu"
            logger.info("💻 GPU не найден — используем CPU")

        model_size = os.getenv('WHISPER_MODEL_SIZE', 'base')
        logger.info(f"⏳ Загрузка Whisper ({model_size}) на {TranscriptionBot._device}...")

        TranscriptionBot._whisper_model = whisper.load_model(model_size, device=TranscriptionBot._device)

        logger.info(f"✅ Whisper ({model_size}) загружена и готова")

    # ─── VAD-фильтр (вырезание тишины) ────────────────────────────────────────

    def _vad_filter(self, wav_path: str) -> str:
        """Вырезает тишину через WebRTC VAD. Возвращает путь к очищенному файлу (или оригинал)."""
        try:
            import webrtcvad
            from pydub import AudioSegment

            audio = AudioSegment.from_wav(wav_path)

            if audio.frame_rate != 16000:
                audio = audio.set_frame_rate(16000)
            if audio.channels != 1:
                audio = audio.set_channels(1)
            if audio.sample_width != 2:
                audio = audio.set_sample_width(2)

            raw = audio.raw_data
            vad = webrtcvad.Vad(2)
            frame_ms = 30
            frame_bytes = int(16000 * frame_ms / 1000) * 2

            voiced = bytearray()
            total = 0
            speech = 0
            offset = 0
            while offset + frame_bytes <= len(raw):
                frame = raw[offset:offset + frame_bytes]
                if vad.is_speech(frame, 16000):
                    voiced.extend(frame)
                    speech += 1
                total += 1
                offset += frame_bytes

            logger.info(f"VAD: {speech}/{total} фреймов с речью ({speech / total:.1%})" if total else "VAD: нет фреймов")

            if speech == 0:
                raise Exception("В аудио не обнаружено речи")

            cleaned = AudioSegment(data=bytes(voiced), sample_width=2, frame_rate=16000, channels=1)
            cleaned_path = wav_path + ".vad.wav"
            cleaned.export(cleaned_path, format="wav")
            logger.info(f"VAD-обработка: {len(cleaned) / 1000:.1f}с -> {cleaned_path}")
            return cleaned_path

        except ImportError:
            logger.warning("webrtcvad не установлен, VAD пропущен")
            return wav_path
        except Exception as e:
            logger.error(f"VAD-фильтр: {e}, использую оригинал")
            return wav_path

    # ─── Обработчики сообщений ────────────────────────────────────────────────

    def _track_user(self, user_id: int):
        """Добавляет пользователя в список для фонового обновления."""
        self._known_telegram_ids.add(user_id)

    async def handle_voice_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        try:
            user_id = update.effective_user.id
            self._track_user(user_id)
            username = update.effective_user.username or update.effective_user.first_name
            logger.info(f"Голосовое от {username} (ID: {user_id})")

            # Отправляем временное сообщение о начале обработки
            status_msg = await update.message.reply_text("🎤 Распознаю речь...")

            voice_file = await update.message.voice.get_file()
            file_path = f"downloads/voice_{user_id}_{update.message.message_id}.ogg"
            os.makedirs("downloads", exist_ok=True)
            await voice_file.download_to_drive(file_path)

            # Обновляем статус
            await status_msg.edit_text("🧠 Анализирую и категоризирую...")

            transcription = await self.transcribe_audio(file_path)
            note_analysis = await self.analyze_note(transcription, user_id)

            # Редактируем временное сообщение на финальный ответ
            await status_msg.edit_text(
                f"📌 **Тема:** {note_analysis.get('topic')}\n"
                f"📂 **Категория:** {note_analysis.get('category')}\n\n"
                f"📋 **Краткое содержание:**\n{note_analysis.get('summary')}"
            )

            await self.send_to_website(
                user_id=user_id, username=username,
                transcription=transcription,
                message_id=update.message.message_id,
                note_analysis=note_analysis
            )

            if os.path.exists(file_path):
                os.remove(file_path)

        except Exception as e:
            logger.error(f"❌ Ошибка голосового: {e}")
            try:
                await status_msg.edit_text(f"❌ {str(e)}")
            except Exception:
                await update.message.reply_text(f"❌ {str(e)}")

    async def handle_audio_file(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        try:
            user_id = update.effective_user.id
            self._track_user(user_id)
            username = update.effective_user.username or update.effective_user.first_name
            logger.info(f"Аудиофайл от {username} (ID: {user_id})")

            # Отправляем временное сообщение о начале обработки
            status_msg = await update.message.reply_text("🎤 Распознаю аудио...")

            audio_file = await update.message.audio.get_file()
            ext = audio_file.file_path.split('.')[-1] if '.' in audio_file.file_path else 'mp3'
            file_path = f"downloads/audio_{user_id}_{update.message.message_id}.{ext}"
            os.makedirs("downloads", exist_ok=True)
            await audio_file.download_to_drive(file_path)

            # Обновляем статус
            await status_msg.edit_text("🧠 Анализирую и категоризирую...")

            transcription = await self.transcribe_audio(file_path)
            note_analysis = await self.analyze_note(transcription, user_id)

            # Редактируем временное сообщение на финальный ответ
            await status_msg.edit_text(
                f"📌 **Тема:** {note_analysis.get('topic')}\n"
                f"📂 **Категория:** {note_analysis.get('category')}\n\n"
                f"📋 **Краткое содержание:**\n{note_analysis.get('summary')}"
            )

            await self.send_to_website(
                user_id=user_id, username=username,
                transcription=transcription,
                message_id=update.message.message_id,
                original_filename=update.message.audio.file_name,
                note_analysis=note_analysis
            )

            if os.path.exists(file_path):
                os.remove(file_path)

        except Exception as e:
            logger.error(f"❌ Ошибка аудиофайла: {e}")
            try:
                await status_msg.edit_text(f"❌ {str(e)}")
            except Exception:
                await update.message.reply_text(f"❌ {str(e)}")

    # ─── Пайплайн транскрибации ───────────────────────────────────────────────

    async def transcribe_audio(self, file_path: str) -> str:
        """Конвертация → VAD → транскрибация."""
        try:
            wav_path = self._convert_to_wav(file_path)
            processed_path = self._vad_filter(wav_path)
            transcription = await self._transcribe_with_local_whisper(processed_path)

            for p in [wav_path, processed_path]:
                if p and p != file_path and os.path.exists(p):
                    try:
                        os.remove(p)
                    except Exception:
                        pass

            return transcription

        except Exception as e:
            logger.error(f"Ошибка транскрибации: {e}")
            raise

    def _convert_to_wav(self, file_path: str) -> str:
        """Конвертация в 16kHz mono WAV через ffmpeg."""
        if not self._ffmpeg_path:
            raise Exception("FFmpeg не установлен. Выполните: winget install ffmpeg")

        wav_path = f"{file_path}.wav"
        try:
            subprocess.run(
                [self._ffmpeg_path, '-i', file_path,
                 '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le',
                 wav_path, '-y'],
                check=True, capture_output=True, timeout=120
            )
            logger.info(f"WAV: {wav_path}")
            return wav_path
        except subprocess.CalledProcessError as e:
            raise Exception(f"Ошибка ffmpeg: {e.stderr.decode()}")
        except subprocess.TimeoutExpired:
            raise Exception("FFmpeg превысил таймаут (120с)")

    async def _transcribe_with_local_whisper(self, file_path: str) -> str:
        """Транскрибация через предзагруженную модель Whisper."""
        if TranscriptionBot._whisper_model is None:
            raise Exception("Модель Whisper не загружена — перезапустите бота")

        model = TranscriptionBot._whisper_model
        logger.info(f"Транскрибация на {TranscriptionBot._device}...")

        result = model.transcribe(
            file_path,
            language="ru",
            task="transcribe",
            fp16=False,
            condition_on_previous_text=False,
            verbose=False
        )
        text = result["text"].strip()
        logger.info(f"Транскрибация: {len(text)} символов")
        return text

    # ─── Ollama анализ + выбор категории ────────────────────────────────────────

    async def analyze_note(self, text: str, telegram_id: int = None) -> dict:
        try:
            import aiohttp

            # Получаем личные категории пользователя с сервера
            categories = await asyncio.get_event_loop().run_in_executor(
                None, self._fetch_categories, telegram_id
            )

            # Формируем список категорий для промпта
            cat_names = [c.get("name", "Без категории") for c in categories if c.get("name")]
            cat_list_str = "\n".join(f"- {name}" for name in cat_names) if cat_names else "—"
            logger.info(f"📋 Список категорий для Ollama ({len(cat_names)}): {cat_names}")

            url = f"{self.ollama_base_url}/api/chat"
            headers = {"Content-Type": "application/json"}

            # Если нет категорий — всё равно просим Ollama выделить тему и summary, но категория фиксирована
            if not cat_names:
                logger.info("📭 У пользователя нет личных топиков — категория 'заметка без темы'")
                prompt = (
                    "Проанализируй текст заметки на русском языке и выдели САМУЮ ВАЖНУЮ мысль "
                    "(не пересказ и не первые предложения).\n\n"
                    "Верни ответ строго в JSON формате, ТОЛЬКО НА РУССКОМ:\n"
                    '{\n  "topic": "Короткая тема (3-7 слов) на русском",\n'
                    '  "summary": "Главный смысл заметки за 5 секунд на русском"\n}\n\n'
                    "ВАЖНО:\n- Отвечай ТОЛЬКО на русском языке\n"
                    "- Не копируй первые предложения\n"
                    "- Игнорируй лишние детали\n"
                    "- Сфокусируйся на главной идее\n\n"
                    f"Текст заметки:\n{text}"
                )
            else:
                prompt = (
                    "Проанализируй текст заметки на русском языке и выдели САМУЮ ВАЖНУЮ мысль "
                    "(не пересказ и не первые предложения).\n\n"
                    "Доступные категории для этой заметки:\n"
                    f"{cat_list_str}\n\n"
                    "Выбери ОДНУ наиболее подходящую категорию из списка выше.\n"
                    "Если ни одна не подходит, выбери самую общую.\n\n"
                    "Верни ответ строго в JSON формате, ТОЛЬКО НА РУССКОМ:\n"
                    '{\n  "topic": "Короткая тема (3-7 слов) на русском",\n'
                    '  "summary": "Главный смысл заметки за 5 секунд на русском",\n'
                    '  "category": "Название выбранной категории на русском"\n}\n\n'
                    "ВАЖНО:\n- Отвечай ТОЛЬКО на русском языке\n"
                    "- Не копируй первые предложения\n"
                    "- Игнорируй лишние детали\n"
                    "- Сфокусируйся на главной идее\n"
                    "- Название категории должно быть ТОЧНО из списка выше\n\n"
                    f"Текст заметки:\n{text}"
                )

            payload = {
                "model": self.ollama_model,
                "messages": [
                    {
                        "role": "system",
                        "content": "Ты — русскоязычный ассистент. Отвечай ТОЛЬКО на русском языке. Никогда не используй китайский, английский или другие языки. Всегда отвечай строго в JSON формате."
                    },
                    {"role": "user", "content": prompt}
                ],
                "stream": False,
                "options": {
                    "temperature": 0.3,
                    "num_predict": 500,
                    "top_p": 0.9
                }
            }

            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers, json=payload, timeout=60) as resp:
                    if resp.status == 200:
                        result = await resp.json()
                        content = result['message']['content'].strip()

                        try:
                            json_match = re.search(r'\{[\s\S]*\}', content)
                            if json_match:
                                content = json_match.group(0)
                            analyzed = json.loads(content)

                            # Если категорий нет — ставим "заметка без темы"
                            if not cat_names:
                                analyzed["category"] = "заметка без темы"
                            else:
                                # Проверяем, что категория из списка
                                cat = analyzed.get("category", "")
                                if cat and cat not in cat_names:
                                    for c in cat_names:
                                        if cat.lower() in c.lower() or c.lower() in cat.lower():
                                            analyzed["category"] = c
                                            break
                                    else:
                                        analyzed["category"] = cat_names[0]

                            summary = analyzed.get("summary", "")
                            text_start = text[:100].strip()
                            if summary and summary[:50] in text_start:
                                retry_payload = {
                                    "model": self.ollama_model,
                                    "messages": [{
                                        "role": "user",
                                        "content": f"Главная мысль одним предложением:\n{text}"
                                    }],
                                    "stream": False,
                                    "options": {
                                        "temperature": 0.2,
                                        "num_predict": 200,
                                        "top_p": 0.7
                                    }
                                }
                                async with session.post(url, headers=headers, json=retry_payload,
                                                         timeout=60) as r2:
                                    if r2.status == 200:
                                        r2r = await r2.json()
                                        r2c = r2r['message']['content'].strip()
                                        m = re.search(r'\{[\s\S]*\}', r2c)
                                        if m:
                                            summary = json.loads(m.group(0)).get("summary", r2c)
                                        else:
                                            summary = r2c
                                        analyzed["summary"] = summary

                            return analyzed
                        except (json.JSONDecodeError, KeyError):
                            pass

                    # Fallback: если Ollama не ответила JSON'ом
                    return {
                        "topic": self._extract_topic(text),
                        "category": "заметка без темы",
                        "summary": text[:150] + "..." if len(text) > 150 else text
                    }

        except Exception:
            pass

        # Ultimate fallback
        return {
            "topic": self._extract_topic(text),
            "category": "заметка без темы",
            "summary": self._extract_summary(text)
        }

    def _extract_topic(self, text: str) -> str:
        """Извлекает тему из текста (без Ollama)."""
        clean = re.sub(r'\s+', ' ', text).strip()
        sentences = [s.strip() for s in re.split(r'[.!?]+', clean) if len(s.strip()) > 10]
        if sentences:
            first = sentences[0]
            words = first.split()[:7]
            return ' '.join(words) + ('...' if len(first.split()) > 7 else '')
        words = clean.split()[:7]
        return ' '.join(words) + ('...' if len(clean.split()) > 7 else '')

    def _extract_summary(self, text: str) -> str:
        """Извлекает краткое содержание (без Ollama)."""
        clean = re.sub(r'\s+', ' ', text).strip()
        sentences = [s.strip() for s in re.split(r'[.!?]+', clean) if len(s.strip()) > 20]
        if len(sentences) <= 3:
            return clean
        parts = [sentences[0], sentences[len(sentences) // 2], sentences[-1]]
        return '.\n'.join(parts) + '.'

    # ─── Отправка на сайт ─────────────────────────────────────────────────────

    async def send_to_website(self, user_id: int, username: str, transcription: str,
                              message_id: int, original_filename: str = None,
                              note_analysis: dict = None):
        try:
            endpoint = f"{self.api_url}/external/notes"
            # Категория всегда от Ollama, без хардкода
            category_name = "Без категории"
            if note_analysis and note_analysis.get("category"):
                category_name = note_analysis["category"]

            payload = {
                "telegramId": user_id,
                "content": transcription,
                "categoryName": category_name,
                "externalId": f"voice_{user_id}_{message_id}",
                "source": "telegram_voice"
            }
            if note_analysis:
                payload["topic"] = note_analysis.get("topic")
                payload["summary"] = note_analysis.get("summary")

            headers = {"Content-Type": "application/json"}
            if self.api_key:
                headers["Authorization"] = f"Bearer {self.api_key}"

            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: requests.post(endpoint, json=payload, headers=headers, timeout=10)
            )

            if response.status_code in (200, 201):
                logger.info(f"Отправлено на сайт для {username} (категория: {category_name})")
            else:
                logger.warning(f"Не удалось отправить: {response.status_code}")
                self.save_locally(user_id, transcription, original_filename)

        except Exception as e:
            logger.error(f"Ошибка отправки: {e}")
            self.save_locally(user_id, transcription, original_filename)

    def save_locally(self, user_id: int, transcription: str,
                     original_filename: str = None, username: str = "unknown"):
        try:
            ts = int(time.time())
            path = f"transcriptions/transcription_{user_id}_{ts}.txt"
            os.makedirs("transcriptions", exist_ok=True)
            with open(path, 'w', encoding='utf-8') as f:
                f.write(f"User ID: {user_id}\nUsername: {username}\n")
                if original_filename:
                    f.write(f"Original file: {original_filename}\n")
                f.write(f"Timestamp: {ts}\n\n{transcription}\n")
            logger.info(f"Сохранено локально: {path}")
        except Exception as e:
            logger.error(f"Ошибка сохранения: {e}")

    # ─── Запуск / остановка ───────────────────────────────────────────────────

    async def _background_cache_updater(self):
        """Фоновая задача: каждые 15 секунд обновляет кэш категорий для всех известных пользователей."""
        while True:
            await asyncio.sleep(15)
            user_ids = list(self._known_telegram_ids)
            if user_ids:
                logger.info(f"🔄 Фоновое обновление категорий для {len(user_ids)} пользователей...")
                for uid in user_ids:
                    # Сбрасываем кэш для этого пользователя
                    cache_attr = f'_categories_cache_{uid}'
                    cache_ts_attr = f'_categories_cache_{uid}_ts'
                    setattr(self, cache_attr, None)
                    setattr(self, cache_ts_attr, 0)
                    # Принудительно загружаем
                    try:
                        await asyncio.get_event_loop().run_in_executor(
                            None, self._fetch_categories, uid
                        )
                    except Exception:
                        pass

    async def start(self):
        logger.info("Запуск бота...")

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._preload_whisper)

        # Предзагружаем категории при старте
        await loop.run_in_executor(None, self._fetch_categories)

        # Запускаем фоновое обновление категорий каждые 15 секунд
        asyncio.create_task(self._background_cache_updater())
        logger.info("⏰ Фоновое обновление категорий запущено (каждые 15 секунд)")

        await self.application.initialize()

        admin_id = os.getenv('ADMIN_USER_ID')
        if admin_id:
            try:
                await self.application.bot.send_message(
                    chat_id=admin_id,
                    text="🤖 Бот для транскрибации запущен!"
                )
            except Exception:
                pass

        await self.application.run_polling(allowed_updates=Update.ALL_TYPES)

    async def stop(self):
        logger.info("Остановка бота...")
        try:
            await self.application.shutdown()
        except RuntimeError:
            pass


def main():
    try:
        bot = TranscriptionBot()
        # Предзагружаем модель Whisper сразу (синхронно)
        bot._preload_whisper()
        bot.application.run_polling(allowed_updates=Update.ALL_TYPES)
    except KeyboardInterrupt:
        logger.info("Бот остановлен пользователем")
    except Exception as e:
        logger.error(f"Критическая ошибка: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()