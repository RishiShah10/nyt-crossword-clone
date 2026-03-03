from __future__ import annotations

import logging
from typing import Optional

from openai import AsyncOpenAI

from ..models.puzzle import Puzzle
from .crossword.puzzle_builder import build_puzzle

logger = logging.getLogger(__name__)


class OpenAIService:
    def __init__(self, api_key: str) -> None:
        self.api_key = api_key
        self.client: Optional[AsyncOpenAI] = (
            AsyncOpenAI(api_key=api_key) if api_key else None
        )

    async def generate_mini_crossword(
        self, topics: str, title: str
    ) -> Optional[Puzzle]:
        """
        Generate a valid 5x5 mini crossword using the hybrid CSP + LLM pipeline.

        The LLM is used for two things only:
          1. Expanding the topic string into candidate theme words (thesaurus)
          2. Writing clues for confirmed, solver-validated answers

        Structural correctness (real words, cross-letter consistency, grid symmetry)
        is guaranteed by the deterministic CSP engine, not by the LLM.
        """
        if not self.client:
            logger.error("OpenAI API key not set")
            return None

        try:
            puzzle_dict = await build_puzzle(
                topics=topics,
                title=title,
                openai_client=self.client,
            )
            return Puzzle.model_validate(puzzle_dict)
        except RuntimeError as exc:
            logger.error("Puzzle builder failed: %s", exc)
            return None
        except Exception as exc:
            logger.exception("Unexpected error generating crossword: %s", exc)
            return None
