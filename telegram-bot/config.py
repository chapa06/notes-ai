"""
Configuration loader for the Telegram transcription bot.
"""
import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Centralized configuration from environment variables."""

    TELEGRAM_BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
    API_URL: str = os.getenv("API_URL", "http://localhost:3000/api")
    API_KEY: str = os.getenv("API_KEY", "")
    USER_TOKEN: str = os.getenv("USER_TOKEN", "")
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "qwen2.5:1.5b")
    WHISPER_MODEL_SIZE: str = os.getenv("WHISPER_MODEL_SIZE", "base")
    ADMIN_USER_ID: str = os.getenv("ADMIN_USER_ID", "")

    DOWNLOADS_DIR: str = "downloads"
    TRANSCRIPTIONS_DIR: str = "transcriptions"


config = Config()