"""
Sending transcribed and analyzed notes to the web API, with local save fallback.
"""
import logging
import os
import time
from typing import Optional

import requests

from config import config
from transcriber import AudioProcessor

logger = logging.getLogger(__name__)


class NoteSender:
    """Sends notes to the web API, with local file fallback."""

    def __init__(self):
        self.api_url = config.API_URL
        self.api_key = config.API_KEY

    def send(
        self,
        user_id: int,
        username: str,
        transcription: str,
        message_id: int,
        note_analysis: Optional[dict] = None,
        original_filename: Optional[str] = None,
    ) -> None:
        """Send a transcribed note to the web API."""
        endpoint = f"{self.api_url}/external/notes"
        category_name = "Без категории"
        if note_analysis and note_analysis.get("category"):
            category_name = note_analysis["category"]

        payload = {
            "telegramId": user_id,
            "content": transcription,
            "categoryName": category_name,
            "externalId": f"voice_{user_id}_{message_id}",
            "source": "telegram_voice",
        }
        if note_analysis:
            payload["topic"] = note_analysis.get("topic")
            payload["summary"] = note_analysis.get("summary")

        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        try:
            response = requests.post(endpoint, json=payload, headers=headers, timeout=10)
            if response.status_code in (200, 201):
                logger.info(
                    f"Отправлено на сайт для {username} (категория: {category_name})"
                )
            else:
                logger.warning(f"Не удалось отправить: {response.status_code}")
                self._save_locally(user_id, transcription, original_filename, username)
        except Exception as e:
            logger.error(f"Ошибка отправки: {e}")
            self._save_locally(user_id, transcription, original_filename, username)

    @staticmethod
    def _save_locally(
        user_id: int,
        transcription: str,
        original_filename: Optional[str] = None,
        username: str = "unknown",
    ) -> None:
        """Save transcription to a local file as fallback."""
        try:
            ts = int(time.time())
            path = f"{config.TRANSCRIPTIONS_DIR}/transcription_{user_id}_{ts}.txt"
            os.makedirs(config.TRANSCRIPTIONS_DIR, exist_ok=True)
            with open(path, "w", encoding="utf-8") as f:
                f.write(f"User ID: {user_id}\nUsername: {username}\n")
                if original_filename:
                    f.write(f"Original file: {original_filename}\n")
                f.write(f"Timestamp: {ts}\n\n{transcription}\n")
            logger.info(f"Сохранено локально: {path}")
        except Exception as e:
            logger.error(f"Ошибка сохранения: {e}")