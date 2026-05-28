"""
AI analysis of transcribed text using Ollama: topic extraction, summarization, and categorization.
"""
import asyncio
import json
import logging
import re
from typing import Optional

import aiohttp
import requests

from config import config

logger = logging.getLogger(__name__)


class NoteAnalyzer:
    """Analyzes transcribed text to extract topic, summary, and category via Ollama."""

    def __init__(self):
        self.ollama_url = f"{config.OLLAMA_BASE_URL}/api/chat"

    async def analyze(
        self, text: str, categories: list[dict], telegram_id: Optional[int] = None
    ) -> dict:
        """Analyze text using Ollama, with fallback extraction."""
        try:
            return await self._analyze_with_ollama(text, categories)
        except Exception:
            logger.exception("Ollama analysis failed, using fallback")
            return self._fallback_analysis(text, categories)

    async def _analyze_with_ollama(self, text: str, categories: list[dict]) -> dict:
        """Send text to Ollama for AI-powered analysis."""
        cat_names = [c.get("name", "") for c in categories if c.get("name")]

        prompt = self._build_prompt(text, cat_names)
        payload = {
            "model": config.OLLAMA_MODEL,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "Ты — русскоязычный ассистент. Отвечай ТОЛЬКО на русском языке. "
                        "Никогда не используй китайский, английский или другие языки. "
                        "Всегда отвечай строго в JSON формате."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            "stream": False,
            "options": {
                "temperature": 0.3,
                "num_predict": 500,
                "top_p": 0.9,
            },
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(
                self.ollama_url, json=payload, timeout=60
            ) as resp:
                if resp.status != 200:
                    raise RuntimeError(f"Ollama returned {resp.status}")

                result = await resp.json()
                content = result["message"]["content"].strip()

                analyzed = self._parse_json_response(content)

                # Fix category
                if not cat_names:
                    analyzed["category"] = "заметка без темы"
                else:
                    analyzed["category"] = self._match_category(
                        analyzed.get("category", ""), cat_names
                    )

                # Retry summary if it's just the start of the original text
                if self._is_summary_copy(analyzed.get("summary", ""), text):
                    analyzed["summary"] = await self._retry_summary(text, session)

                return analyzed

    def _build_prompt(self, text: str, cat_names: list[str]) -> str:
        """Build the LLM prompt based on available categories."""
        cat_list_str = (
            "\n".join(f"- {name}" for name in cat_names) if cat_names else "—"
        )
        logger.info(f"📋 Список категорий для Ollama ({len(cat_names)}): {cat_names}")

        if not cat_names:
            return (
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

        return (
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

    @staticmethod
    def _parse_json_response(content: str) -> dict:
        """Extract and parse JSON from LLM response."""
        json_match = re.search(r"\{[\s\S]*\}", content)
        if json_match:
            content = json_match.group(0)
        return json.loads(content)

    @staticmethod
    def _match_category(category: str, cat_names: list[str]) -> str:
        """Find the best matching category from the available list."""
        if not category:
            return cat_names[0]

        cat_lower = category.lower()
        for c in cat_names:
            if cat_lower in c.lower() or c.lower() in cat_lower:
                return c
        return cat_names[0]

    @staticmethod
    def _is_summary_copy(summary: str, text: str) -> bool:
        """Check if the summary is just copying the start of the original text."""
        text_start = text[:100].strip()
        return bool(summary and summary[:50] in text_start)

    async def _retry_summary(self, text: str, session: aiohttp.ClientSession) -> str:
        """Retry summary extraction with a simpler prompt."""
        retry_payload = {
            "model": config.OLLAMA_MODEL,
            "messages": [
                {
                    "role": "user",
                    "content": f"Главная мысль одним предложением:\n{text}",
                }
            ],
            "stream": False,
            "options": {
                "temperature": 0.2,
                "num_predict": 200,
                "top_p": 0.7,
            },
        }
        async with session.post(
            self.ollama_url, json=retry_payload, timeout=60
        ) as r2:
            if r2.status == 200:
                r2r = await r2.json()
                r2c = r2r["message"]["content"].strip()
                m = re.search(r"\{[\s\S]*\}", r2c)
                if m:
                    return json.loads(m.group(0)).get("summary", r2c)
                return r2c
        return ""

    @staticmethod
    def _fallback_analysis(text: str, categories: list[dict]) -> dict:
        """Extract topic and summary without Ollama."""
        cat_names = [c.get("name", "") for c in categories if c.get("name")]
        return {
            "topic": _extract_topic(text),
            "category": cat_names[0] if cat_names else "заметка без темы",
            "summary": _extract_summary(text),
        }


def _extract_topic(text: str) -> str:
    """Extract topic from text (without Ollama)."""
    clean = re.sub(r"\s+", " ", text).strip()
    sentences = [s.strip() for s in re.split(r"[.!?]+", clean) if len(s.strip()) > 10]
    if sentences:
        first = sentences[0]
        words = first.split()[:7]
        return " ".join(words) + ("..." if len(first.split()) > 7 else "")
    words = clean.split()[:7]
    return " ".join(words) + ("..." if len(clean.split()) > 7 else "")


def _extract_summary(text: str) -> str:
    """Extract a brief summary (without Ollama)."""
    clean = re.sub(r"\s+", " ", text).strip()
    sentences = [s.strip() for s in re.split(r"[.!?]+", clean) if len(s.strip()) > 20]
    if len(sentences) <= 3:
        return clean
    parts = [sentences[0], sentences[len(sentences) // 2], sentences[-1]]
    return ".\n".join(parts) + "."