import logging
import json
import datetime
from typing import Optional
from openai import AsyncOpenAI
from ..config import settings
from ..models.puzzle import Puzzle

logger = logging.getLogger(__name__)

class OpenAIService:
    def __init__(self, api_key: str):
        self.api_key = api_key
        if api_key:
            self.client = AsyncOpenAI(api_key=api_key)
        else:
            self.client = None

    async def generate_mini_crossword(self, topics: str, title: str) -> Optional[Puzzle]:
        """Generate a 5x5 mini crossword puzzle about topics using OpenAI."""
        if not self.client:
            logger.error("OpenAI API key not set")
            return None

        today = datetime.date.today().strftime("%Y-%m-%d")
        
        system_prompt = """You are an expert crossword constructor for the New York Times.
        Your goal is to build a high-quality 5x5 mini crossword.
        
        RULES:
        1. GRID: Must be exactly 5x5. Use letters A-Z and "." for black squares.
        2. SYMMETRY: The grid must have 180-degree rotational symmetry. If (r, c) is a black square, then (4-r, 4-c) must also be a black square.
        3. CONNECTIVITY: All white cells must be part of a single contiguous block (no "islands").
        4. VALIDITY: Every white cell must be part of exactly one Across word AND exactly one Down word. No words shorter than 3 letters (except in rare cases for 5x5 minis, but prefer 3-5).
        5. NUMBERING: Numbers are assigned sequentially from left-to-right, top-to-bottom. A cell gets a number if it is the start of an Across or Down word.
        
        OUTPUT FORMAT:
        Return a JSON object matching the NYT crossword format:
        {
            "size": {"rows": 5, "cols": 5},
            "grid": ["A","B","C",...], (flat array of 25 strings)
            "gridnums": [1,2,3,0,...], (flat array of 25 integers, 0 for cells without numbers)
            "clues": {"across": ["1. Clue", ...], "down": ["1. Clue", ...]},
            "answers": {"across": ["ABC", ...], "down": ["XYZ", ...]},
            "title": "Title",
            "author": "AI Constructor",
            "date": "YYYY-MM-DD"
        }
        """

        user_prompt = f"""Construct a 5x5 mini crossword titled '{title}' about: {topics}.
        Ensure the clues are clever and related to the topics.
        Ensure 'grid' and 'gridnums' are exactly 25 elements long.
        Ensure the black squares ('.') in the grid perfectly match the word structure in the clues.
        """

        try:
            response = await self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                response_format={ "type": "json_object" },
                temperature=0.7
            )
            
            data = json.loads(response.choices[0].message.content)
            
            # Recalculate gridnums to ensure they ALWAYS match the grid structure
            # This fixes the "black boxes must match" requirement
            grid = data.get("grid", [])
            if len(grid) == 25:
                calculated_nums = [0] * 25
                current_num = 1
                for r in range(5):
                    for c in range(5):
                        idx = r * 5 + c
                        if grid[idx] == ".":
                            continue
                            
                        starts_across = (c == 0 or grid[idx-1] == ".") and (c < 4 and grid[idx+1] != ".")
                        starts_down = (r == 0 or grid[idx-5] == ".") and (r < 4 and grid[idx+5] != ".")
                        
                        if starts_across or starts_down:
                            calculated_nums[idx] = current_num
                            current_num += 1
                
                data["gridnums"] = calculated_nums
                logger.info("Recalculated gridnums to ensure consistency")

            return Puzzle.model_validate(data)
            
        except Exception as e:
            logger.error(f"Error generating crossword: {e}")
            return None
