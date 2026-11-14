"""Wrapper gọi DeepSeek (OpenAI-compatible): retry, timeout, JSON mode + kiểm schema."""
import json
import re
import time
from typing import List, Type, TypeVar

from openai import OpenAI
from pydantic import BaseModel, ValidationError

from . import config

T = TypeVar("T", bound=BaseModel)
_client = None


def client() -> OpenAI:
    global _client
    if _client is None:
        if not config.DEEPSEEK_API_KEY:
            raise RuntimeError("Chưa cấu hình DEEPSEEK_API_KEY trong file .env")
        _client = OpenAI(api_key=config.DEEPSEEK_API_KEY, base_url=config.DEEPSEEK_BASE_URL, timeout=config.LLM_TIMEOUT)
    return _client


def chat(messages: List[dict], json_mode: bool = False, temperature: float = 0.3, max_tokens: int = 4096) -> str:
    """Gọi LLM, tự retry khi lỗi mạng / rate limit."""
    kwargs = dict(model=config.DEEPSEEK_MODEL, messages=messages, temperature=temperature, max_tokens=max_tokens)
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    last = None
    for attempt in range(3):
        try:
            r = client().chat.completions.create(**kwargs)
            return r.choices[0].message.content or ""
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"Gọi DeepSeek thất bại: {last}")


def _loads(text: str) -> dict:
    text = text.strip()
    m = re.search(r"```(?:json)?\s*(.*?)```", text, re.S)
    if m:
        text = m.group(1).strip()
    return json.loads(text)


def chat_json(messages: List[dict], model: Type[T], retries: int = 2, temperature: float = 0.3, max_tokens: int = 4096) -> T:
    """JSON mode + pydantic. Sai schema -> nói rõ lỗi và yêu cầu làm lại (chưa cho đi tiếp)."""
    msgs = list(messages)
    err = None
    for _ in range(retries + 1):
        raw = chat(msgs, json_mode=True, temperature=temperature, max_tokens=max_tokens)
        try:
            return model.model_validate(_loads(raw))
        except (json.JSONDecodeError, ValidationError) as e:
            err = e
            msgs = list(messages) + [
                {"role": "assistant", "content": raw[:3000]},
                {"role": "user", "content": f"Output KHÔNG hợp lệ schema/JSON: {str(e)[:600]}\nHãy trả lại JSON hợp lệ đúng schema, không giải thích."},
            ]
    raise RuntimeError(f"LLM trả JSON sai schema sau nhiều lần thử: {err}")
