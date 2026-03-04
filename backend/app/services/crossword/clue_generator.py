from __future__ import annotations

import json
import logging
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

# Clue generation prompt — LLM receives confirmed answers only.
# It has zero structural responsibility; its only job is to write
# a witty, themed clue for each word.
_SYSTEM = (
    "You are an expert NYT crossword puzzle editor. "
    "Your job: write one clue per answer word. Each clue must be factually accurate "
    "and unambiguously lead to EXACTLY the given answer — not a similar word. "
    "Be clever, punny, or thematic where natural, but factual accuracy comes first. "
    "Never include the answer word in the clue. Clues are concise (under 10 words). "
    "Use standard crossword conventions: abbr. for abbreviations, ___ for fill-in-the-blank."
)

_USER_TEMPLATE = """\
Theme: {theme}

Write one crossword clue for each answer. Requirements:
- The clue must factually and unambiguously point to EXACTLY that word (not a synonym or similar word)
- Tie the clue to the theme "{theme}" if natural, otherwise write a standard crossword clue
- Never use the answer word or an obvious inflection of it in the clue
- Keep clues concise (under 10 words)
- For uncommon words, use "Old word for ___" or "___ (archaic)" style

Answers:
{answer_block}

Return ONLY valid JSON:
{{
  "clues": {{
    "1-across": "clue text",
    "2-down": "clue text"
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
            model="gpt-4o",  # better factual accuracy for clue writing
            messages=[
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": user_msg},
            ],
            response_format={"type": "json_object"},
            temperature=0.7,
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
