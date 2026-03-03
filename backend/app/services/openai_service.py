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
        
        system_prompt = """You are a professional crossword puzzle constructor. 
        Your task is to generate a 5x5 mini crossword puzzle.
        Standard rules apply:
        1. Cells contain a single uppercase letter (A-Z) or a black square (".").
        2. Black squares should be used sparingly (0-4 in a 5x5 grid).
        3. Every white cell must be part of BOTH an 'Across' and a 'Down' word.
        4. No single-letter words allowed.
        5. Words must be common English words, or proper nouns related to the user's topics.
        6. Grid must be rotationally symmetric (180 degrees).
        7. Numbers (gridnums) are assigned from left-to-right, top-to-bottom. A cell gets a number if it starts an 'Across' or 'Down' word (or both).
        8. Return the puzzle in the exact NYT JSON format with "size", "grid", "gridnums", "clues", "answers", "title", "author", "date".
        9. Every clue string must start with its number and a dot, e.g., "1. Feline".
        10. Answer strings should be just the word in uppercase.
        """

        user_prompt = f"""Generate a 5x5 mini crossword puzzle with the title '{title}' about these topics: {topics}.
        Return ONLY valid JSON.
        
        Format Example:
        {{
            "size": {{"rows": 5, "cols": 5}},
            "grid": ["S","P","E","E","D","M","O","O","N","S",...], (length 25)
            "gridnums": [1,2,3,4,5,6,0,0,0,0,...], (length 25)
            "clues": {{"across": ["1. Rapid", "6. Satellite", ...], "down": ["1. ...", ...]}},
            "answers": {{"across": ["SPEED", "MOONS", ...], "down": ["...", ...]}},
            "title": "{title}",
            "author": "AI Generator",
            "date": "{today}"
        }}
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
            
            data_str = response.choices[0].message.content
            logger.info("OpenAI response received")
            
            # Basic validation of the JSON structure before Pydantic
            data = json.loads(data_str)
            
            # Ensure grid and gridnums have length 25
            if len(data.get("grid", [])) != 25:
                logger.error(f"Invalid grid length: {len(data.get('grid', []))}")
                return None
            if len(data.get("gridnums", [])) != 25:
                logger.error(f"Invalid gridnums length: {len(data.get('gridnums', []))}")
                return None

            return Puzzle.model_validate(data)
            
        except Exception as e:
            logger.error(f"Error generating crossword: {e}")
            return None
