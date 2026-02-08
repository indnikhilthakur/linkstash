import json
import logging
import os
from typing import IO, List

from openai import AsyncOpenAI

logger = logging.getLogger(__name__)


class LLMClient:
    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        vision_model: str | None = None,
        transcription_model: str | None = None,
    ) -> None:
        self._api_key = api_key or os.environ.get("OPENAI_API_KEY", "")
        self._model = model or os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
        self._vision_model = vision_model or os.environ.get("OPENAI_VISION_MODEL", self._model)
        self._transcription_model = transcription_model or os.environ.get("OPENAI_TRANSCRIPTION_MODEL", "whisper-1")
        self._client: AsyncOpenAI | None = None

    def _get_client(self) -> AsyncOpenAI:
        if not self._api_key:
            raise RuntimeError("OPENAI_API_KEY is required for LLM features")
        if not self._client:
            self._client = AsyncOpenAI(api_key=self._api_key)
        return self._client

    async def generate_summary_and_tags(self, content: str) -> dict:
        system_message = (
            "You are a metadata extraction assistant. Given content about a link or note, "
            "generate a concise summary (2-3 sentences) and 3-5 relevant tags. "
            "Respond ONLY in valid JSON format: {\"summary\": \"...\", \"tags\": [\"tag1\", \"tag2\"]}"
        )
        try:
            client = self._get_client()
            response = await client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": f"Generate summary and tags for:\n{content}"},
                ],
                response_format={"type": "json_object"},
                temperature=0.2,
            )
            text = response.choices[0].message.content or "{}"
            data = json.loads(text)
            return {
                "summary": (data.get("summary") or "").strip(),
                "tags": (data.get("tags") or [])[:5],
            }
        except Exception as exc:
            logger.error(f"LLM summary/tags failed: {exc}")
            return {"summary": "", "tags": []}

    async def transcribe_audio(self, audio_file: IO[bytes]) -> str:
        try:
            client = self._get_client()
            response = await client.audio.transcriptions.create(
                model=self._transcription_model,
                file=audio_file,
                response_format="text",
            )
            return (response or "").strip()
        except Exception as exc:
            logger.error(f"LLM transcription failed: {exc}")
            return ""

    async def extract_image_text(self, image_base64: str) -> str:
        system_message = (
            "You are an OCR assistant. Extract all readable text and describe the key content "
            "from the image. Be concise."
        )
        try:
            client = self._get_client()
            response = await client.chat.completions.create(
                model=self._vision_model,
                messages=[
                    {"role": "system", "content": system_message},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": "Extract text and describe key content from this image."},
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"},
                            },
                        ],
                    },
                ],
                temperature=0.2,
            )
            return (response.choices[0].message.content or "").strip()
        except Exception as exc:
            logger.error(f"LLM OCR failed: {exc}")
            return ""

    async def select_relevant_indices(self, query: str, notes_summary: List[str]) -> List[int]:
        system_message = (
            "You are a search assistant. Given a user query and a list of notes, return the "
            "indices of the most relevant notes. Respond ONLY in JSON format as "
            "{\"indices\": [0, 3, 5]}. If none match, return {\"indices\": []}."
        )
        try:
            client = self._get_client()
            response = await client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": system_message},
                    {
                        "role": "user",
                        "content": f"Query: {query}\n\nNotes:\n" + "\n".join(notes_summary),
                    },
                ],
                response_format={"type": "json_object"},
                temperature=0.2,
            )
            text = response.choices[0].message.content or "{}"
            data = json.loads(text)
            indices = data.get("indices")
            if isinstance(indices, list):
                return [int(i) for i in indices if isinstance(i, (int, float))]
            return []
        except Exception as exc:
            logger.error(f"LLM semantic search failed: {exc}")
            return []
