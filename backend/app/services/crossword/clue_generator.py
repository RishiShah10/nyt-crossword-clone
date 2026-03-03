from __future__ import annotations

import json
import logging
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

# Clue generation prompt — LLM receives confirmed answers only.
# It has zero structural responsibility; its only job is to write
# a witty, themed clue for each word.
_SYSTEM = (
    "You are a witty crossword puzzle editor. "
    "You write clues that are clever, punny, or thematically resonant. "
    "You never include the answer word itself in a clue. "
    "Clues are concise — typically under 8 words."
)

_USER_TEMPLATE = """\
Theme: {theme}

Write one crossword clue per answer below. Rules:
- Clue must be uniquely solvable to that exact answer word
- Make it fun, playful, or themed where natural
- Never use the answer word in the clue
- Use wordplay, puns, or misdirection where appropriate
- Keep each clue under 10 words

Answers:
{answer_block}

Return ONLY valid JSON in this exact format:
{{
  "clues": {{
    "1-across": "clue text",
    "2-down": "clue text",
    ...
  }}
}}
"""


def _format_answer_block(numbered_answers: Dict[str, str]) -> str:
    return "\n".join(
        f"  {key}: {word}" for key, word in sorted(numbered_answers.items())
    )


async def generate_clues(
    numbered_answers: Dict[str, str],
    theme: str,
    openai_client,
) -> Dict[str, str]:
    """
    Generate clues for confirmed crossword answers using OpenAI.

    numbered_answers: dict like {"1-across": "SPEED", "1-down": "STONE", ...}
    theme: human-readable topic string, e.g. "basketball, NBA, hoops"
    openai_client: openai.AsyncOpenAI instance

    Returns dict mapping the same keys to clue strings.
    Falls back to generic clues if the API call fails.
    """
    user_msg = _USER_TEMPLATE.format(
        theme=theme,
        answer_block=_format_answer_block(numbered_answers),
    )

    try:
        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",  # cheaper/faster — clues don't need gpt-4o
            messages=[
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": user_msg},
            ],
            response_format={"type": "json_object"},
            temperature=0.9,  # creative for clues — structure already guaranteed
            max_tokens=800,
        )
        data = json.loads(response.choices[0].message.content)
        clues: Dict[str, str] = data.get("clues", {})

        # Sanity check: make sure every answer has a clue
        missing = [k for k in numbered_answers if k not in clues]
        if missing:
            logger.warning("LLM missing clues for: %s — using fallback", missing)
            for k in missing:
                clues[k] = f"Related to {numbered_answers[k].lower()}"

        return clues

    except Exception as exc:
        logger.error("Clue generation failed: %s — using fallback clues", exc)
        return {
            key: f"Crossword answer ({word})"
            for key, word in numbered_answers.items()
        }


def expand_theme_words(raw_words: List[str]) -> List[str]:
    """
    Ask OpenAI to expand theme topics into crossword-friendly words.
    Called separately before the CSP solve. Returns a list of 3-5 letter
    uppercase words (filtered by caller against the word list).
    """
    # This is implemented in puzzle_builder.py to avoid async complexity here.
    raise NotImplementedError("Use puzzle_builder.expand_theme_words instead")
