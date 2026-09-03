#!/usr/bin/env python3
"""Run a natural-language browser task via browser-use Agent."""

from __future__ import annotations

import asyncio
import os
import sys


def _llm():
    from browser_use.llm.base import BaseChatModel

    if os.environ.get("GROK_API_KEY"):
        from browser_use.llm.openai.chat import ChatOpenAI

        return ChatOpenAI(
            model=os.environ.get("BROWSER_USE_MODEL", "grok-4-1-fast"),
            api_key=os.environ["GROK_API_KEY"],
            base_url="https://api.x.ai/v1",
        )

    if os.environ.get("OPENAI_API_KEY"):
        from browser_use.llm.openai.chat import ChatOpenAI

        return ChatOpenAI(
            model=os.environ.get("BROWSER_USE_MODEL", "gpt-4o"),
            api_key=os.environ["OPENAI_API_KEY"],
        )

    if os.environ.get("ANTHROPIC_API_KEY"):
        from browser_use.llm.anthropic.chat import ChatAnthropic

        return ChatAnthropic(
            model=os.environ.get("BROWSER_USE_MODEL", "claude-sonnet-4-6"),
            api_key=os.environ["ANTHROPIC_API_KEY"],
        )

    raise RuntimeError(
        "need GROK_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY in Mac env"
    )


async def _run(task: str) -> int:
    from browser_use import Agent

    agent = Agent(task=task, llm=_llm())
    history = await agent.run(max_steps=int(os.environ.get("BROWSER_USE_MAX_STEPS", "50")))
    result = history.final_result()
    if result:
        print(result)
        return 0
    print(history, file=sys.stderr)
    return 1


def main() -> int:
    task = sys.argv[1] if len(sys.argv) > 1 else sys.stdin.read()
    if not task.strip():
        print("ERR: no task", file=sys.stderr)
        return 1
    try:
        return asyncio.run(_run(task))
    except Exception as exc:
        print(f"ERR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())