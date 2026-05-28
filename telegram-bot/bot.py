"""
Telegram Bot for transcribing voice messages and sending to the web platform.
Uses local Whisper model with VAD filtering and Ollama for AI analysis.
"""
import logging
import os
import asyncio
from typing import Optional

from telegram import Update
from telegram.ext import Application, MessageHandler, filters, ContextTypes

from config import config
from transcriber import AudioProcessor, WhisperModel
from analyzer import NoteAnalyzer
from sender import NoteSender

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)


class TranscriptionBot:
    """Main bot orchestrator: handles messages, transcription, analysis, and sending."""

    def __init__(self) -> None:
        if not config.TELEGRAM_BOT_TOKEN:
            raise ValueError("TELEGRAM_BOT_TOKEN не найден в переменных окружения")

        self.audio_processor = AudioProcessor()
        self.analyzer = NoteAnalyzer()
        self.sender = NoteSender()
        self._known_user_ids: set[int] = set()

        self.application = (
            Application.builder()
            .token(config.TELEGRAM_BOT_TOKEN)
            .connect_timeout(30)
            .read_timeout(30)
            .write_timeout(30)
            .pool_timeout(30)
            .build()
        )

        self.application.add_handler(
            MessageHandler(filters.VOICE, self.handle_voice_message)
        )
        self.application.add_handler(
            MessageHandler(filters.AUDIO, self.handle_audio_file)
        )

        logger.info("Бот инициализирован")

    # ─── Message Handlers ────────────────────────────────────────────────

    async def _download_file(
        self, file, user_id: int, message_id: int, prefix: str, ext: str
    ) -> str:
        """Download a Telegram file and return the local path."""
        os.makedirs(config.DOWNLOADS_DIR, exist_ok=True)
        file_path = f"{config.DOWNLOADS_DIR}/{prefix}_{user_id}_{message_id}.{ext}"
        await file.download_to_drive(file_path)
        return file_path

    async def _process_and_reply(
        self,
        update: Update,
        file_path: str,
        user_id: int,
        username: str,
        message_id: int,
        original_filename: Optional[str] = None,
    ) -> None:
        """Common processing pipeline: transcribe → analyze → send → reply."""
        status_msg = await update.message.reply_text("🎤 Распознаю речь...")

        try:
            await status_msg.edit_text("🧠 Анализирую и категоризирую...")

            transcription = await asyncio.get_event_loop().run_in_executor(
                None, self.audio_processor.transcribe, file_path
            )
            note_analysis = await self.analyzer.analyze(transcription, [])

            # Send reply
            await status_msg.edit_text(
                f"📌 **Тема:** {note_analysis.get('topic')}\n"
                f"📂 **Категория:** {note_analysis.get('category')}\n\n"
                f"📋 **Краткое содержание:**\n{note_analysis.get('summary')}"
            )

            # Send to website (non-blocking)
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self.sender.send(
                    user_id=user_id,
                    username=username,
                    transcription=transcription,
                    message_id=message_id,
                    note_analysis=note_analysis,
                    original_filename=original_filename,
                ),
            )
        except Exception as e:
            logger.error(f"❌ Ошибка обработки: {e}")
            try:
                await status_msg.edit_text(f"❌ {str(e)}")
            except Exception:
                await update.message.reply_text(f"❌ {str(e)}")
        finally:
            if os.path.exists(file_path):
                os.remove(file_path)

    async def handle_voice_message(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE
    ) -> None:
        """Handle incoming voice messages."""
        user_id = update.effective_user.id
        self._known_user_ids.add(user_id)
        username = update.effective_user.username or update.effective_user.first_name
        logger.info(f"Голосовое от {username} (ID: {user_id})")

        voice_file = await update.message.voice.get_file()
        file_path = await self._download_file(
            voice_file, user_id, update.message.message_id, "voice", "ogg"
        )
        await self._process_and_reply(
            update, file_path, user_id, username, update.message.message_id
        )

    async def handle_audio_file(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE
    ) -> None:
        """Handle incoming audio files."""
        user_id = update.effective_user.id
        self._known_user_ids.add(user_id)
        username = update.effective_user.username or update.effective_user.first_name
        logger.info(f"Аудиофайл от {username} (ID: {user_id})")

        audio_file = await update.message.audio.get_file()
        ext = AudioProcessor.get_file_extension(audio_file.file_path)
        file_path = await self._download_file(
            audio_file, user_id, update.message.message_id, "audio", ext
        )
        await self._process_and_reply(
            update,
            file_path,
            user_id,
            username,
            update.message.message_id,
            original_filename=update.message.audio.file_name,
        )

    # ─── Lifecycle ───────────────────────────────────────────────────────

    async def start(self) -> None:
        """Initialize and start polling."""
        logger.info("Запуск бота...")

        # Preload Whisper model
        await asyncio.get_event_loop().run_in_executor(None, WhisperModel.get_instance)

        await self.application.initialize()

        # Notify admin
        if config.ADMIN_USER_ID:
            try:
                await self.application.bot.send_message(
                    chat_id=config.ADMIN_USER_ID,
                    text="🤖 Бот для транскрибации запущен!",
                )
            except Exception:
                pass

        await self.application.run_polling(allowed_updates=Update.ALL_TYPES)

    async def stop(self) -> None:
        """Gracefully stop the bot."""
        logger.info("Остановка бота...")
        try:
            await self.application.shutdown()
        except RuntimeError:
            pass


def main() -> None:
    """Entry point."""
    try:
        bot = TranscriptionBot()
        # Preload Whisper synchronously before starting async loop
        WhisperModel.get_instance()
        bot.application.run_polling(allowed_updates=Update.ALL_TYPES)
    except KeyboardInterrupt:
        logger.info("Бот остановлен пользователем")
    except Exception as e:
        logger.error(f"Критическая ошибка: {e}")
        raise


if __name__ == "__main__":
    main()