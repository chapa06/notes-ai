"""
Audio processing: conversion to WAV, VAD filtering, and Whisper transcription.
"""
import os
import logging
import subprocess
import shutil
from typing import Optional

from config import config

logger = logging.getLogger(__name__)


class WhisperModel:
    """Lazily-loaded singleton Whisper model shared across the application."""
    _instance = None
    _device = "cpu"

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._load_model()
        return cls._instance

    @classmethod
    def _load_model(cls):
        import torch
        import whisper

        if torch.cuda.is_available():
            cls._device = "cuda"
            gpu_name = torch.cuda.get_device_name(0)
            logger.info(f"🔥 CUDA ({gpu_name}) — используем GPU")
        elif torch.backends.mps.is_available():
            cls._device = "mps"
            logger.info("🍎 MPS — используем Apple Metal GPU")
        else:
            cls._device = "cpu"
            logger.info("💻 GPU не найден — используем CPU")

        model_size = config.WHISPER_MODEL_SIZE
        logger.info(f"⏳ Загрузка Whisper ({model_size}) на {cls._device}...")
        cls._instance = whisper.load_model(model_size, device=cls._device)
        logger.info(f"✅ Whisper ({model_size}) загружена и готова")

    @classmethod
    def transcribe(cls, file_path: str) -> str:
        model = cls.get_instance()
        logger.info(f"Транскрибация на {cls._device}...")
        result = model.transcribe(
            file_path,
            language="ru",
            task="transcribe",
            fp16=False,
            condition_on_previous_text=False,
            verbose=False,
        )
        text = result["text"].strip()
        logger.info(f"Транскрибация: {len(text)} символов")
        return text


class AudioProcessor:
    """Handles audio file conversion and VAD filtering."""

    def __init__(self):
        self._ffmpeg_path: Optional[str] = shutil.which("ffmpeg")
        if self._ffmpeg_path:
            logger.info(f"✅ FFmpeg найден: {self._ffmpeg_path}")
        else:
            logger.error("❌ FFmpeg НЕ НАЙДЕН! Транскрибация НЕ БУДЕТ РАБОТАТЬ!")
            logger.error("   Установите ffmpeg: winget install ffmpeg")

    def convert_to_wav(self, file_path: str) -> str:
        """Convert audio to 16kHz mono WAV via ffmpeg."""
        if not self._ffmpeg_path:
            raise RuntimeError("FFmpeg не установлен. Выполните: winget install ffmpeg")

        wav_path = f"{file_path}.wav"
        try:
            subprocess.run(
                [self._ffmpeg_path, "-i", file_path,
                 "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le",
                 wav_path, "-y"],
                check=True, capture_output=True, timeout=120,
            )
            logger.info(f"WAV: {wav_path}")
            return wav_path
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"Ошибка ffmpeg: {e.stderr.decode()}")
        except subprocess.TimeoutExpired:
            raise RuntimeError("FFmpeg превысил таймаут (120с)")

    def vad_filter(self, wav_path: str) -> str:
        """Remove silence using WebRTC VAD. Returns cleaned path or original."""
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

            logger.info(
                f"VAD: {speech}/{total} фреймов с речью ({speech / total:.1%})"
                if total else "VAD: нет фреймов"
            )

            if speech == 0:
                raise RuntimeError("В аудио не обнаружено речи")

            cleaned = AudioSegment(
                data=bytes(voiced), sample_width=2, frame_rate=16000, channels=1
            )
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

    def transcribe(self, file_path: str) -> str:
        """Full pipeline: convert → VAD → Whisper transcription."""
        wav_path = self.convert_to_wav(file_path)
        try:
            processed_path = self.vad_filter(wav_path)
            transcription = WhisperModel.transcribe(processed_path)
            return transcription
        finally:
            for p in [wav_path]:
                if p != file_path and os.path.exists(p):
                    try:
                        os.remove(p)
                    except Exception:
                        pass

    @staticmethod
    def get_file_extension(url: str) -> str:
        """Extract file extension from URL."""
        if "." in url:
            return url.split(".")[-1]
        return "mp3"