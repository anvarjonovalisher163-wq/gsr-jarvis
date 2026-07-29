"""Thin wrapper around the Anthropic SDK.

Cost controls applied here:
  * the system prompt is sent with a cache_control breakpoint (prompt caching
    kicks in automatically once the prompt is long enough for the model);
  * callers pass a bounded message history (CHAT_HISTORY_WINDOW);
  * max_tokens is set per task type from config.
"""
import json
from typing import AsyncIterator

import anthropic

from .config import get_settings, load_system_prompt

_settings = get_settings()

client = anthropic.AsyncAnthropic(api_key=_settings.anthropic_api_key)


def _system_blocks() -> list[dict]:
    return [
        {
            "type": "text",
            "text": load_system_prompt(),
            "cache_control": {"type": "ephemeral"},
        }
    ]


async def ask(messages: list[dict], max_tokens: int | None = None) -> str:
    """Single non-streaming completion; returns concatenated text blocks."""
    resp = await client.messages.create(
        model=_settings.claude_model,
        max_tokens=max_tokens or _settings.claude_max_tokens,
        system=_system_blocks(),
        messages=messages,
    )
    return "".join(b.text for b in resp.content if b.type == "text")


async def ask_json(messages: list[dict], schema: dict, max_tokens: int | None = None) -> dict:
    """Completion constrained to a JSON schema (structured outputs)."""
    resp = await client.messages.create(
        model=_settings.claude_model,
        max_tokens=max_tokens or _settings.claude_max_tokens,
        system=_system_blocks(),
        messages=messages,
        output_config={"format": {"type": "json_schema", "schema": schema}},
    )
    text = next((b.text for b in resp.content if b.type == "text"), "{}")
    return json.loads(text)


async def ask_stream(messages: list[dict], max_tokens: int | None = None) -> AsyncIterator[str]:
    """Streaming completion; yields text deltas as they arrive."""
    async with client.messages.stream(
        model=_settings.claude_model,
        max_tokens=max_tokens or _settings.claude_max_tokens,
        system=_system_blocks(),
        messages=messages,
    ) as stream:
        async for text in stream.text_stream:
            yield text
