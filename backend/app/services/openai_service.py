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
        """Generate and verify a 5x5 mini crossword puzzle using a two-step LLM process."""
        if not self.client:
            logger.error("OpenAI API key not set")
            return None

        today = datetime.date.today().strftime("%Y-%m-%d")
        
        system_prompt = """
You are a professional crossword constructor trained in American-style crosswords.

Your task is to CONSTRUCT and VALIDATE a 5x5 themed mini crossword.

You must follow a strict construction workflow:

STEP 1 — Design the Grid Pattern
- Create a 5x5 grid using letters A-Z and "." for black squares.
- Grid must have 180-degree rotational symmetry.
- All white squares must be connected.
- No word (Across or Down) may be shorter than 3 letters.
- Every white square must belong to exactly one Across and one Down word.

STEP 2 — Extract Word Slots
- Identify all Across and Down slots.
- Ensure slot lengths are between 3 and 5 letters.
- Ensure the grid structure matches the slot structure exactly.

STEP 3 — Fill With Themed Entries
- At least 60% of answers must strongly relate to the provided topics.
- The longest Across answer MUST be clearly theme-relevant.
- Avoid random fill. Avoid generic crossword glue unless absolutely necessary.
- All answers must be real English words or widely recognized proper nouns.

STEP 4 — Generate High-Quality Clues
- Clues must be clever, natural, and accurate.
- Clues must correspond EXACTLY to their answers.
- No vague or placeholder clues.
- The tone should resemble a New York Times Mini.

STEP 5 — Self-Validation (MANDATORY)
Before outputting JSON, internally verify:
- Grid is exactly 25 cells.
- Rotational symmetry is correct.
- White cells form one connected component.
- Every Across answer matches letters in grid.
- Every Down answer matches letters in grid.
- Clue count matches answer count.
- gridnums numbering matches Across/Down starts.

If any constraint fails, reconstruct before outputting.

OUTPUT:
Return ONLY a valid JSON object in this exact format:

{
    "size": {"rows": 5, "cols": 5},
    "grid": ["A","B","C",...], 
    "gridnums": [1,2,3,0,...],
    "clues": {"across": ["1. Clue", ...], "down": ["1. Clue", ...]},
    "answers": {"across": ["ABC", ...], "down": ["XYZ", ...]},
    "title": "Title",
    "author": "AI Constructor",
    "date": "YYYY-MM-DD"
}

Do not include explanations.
Do not include commentary.
Only output valid JSON.
"""

        user_prompt = f"""
Construct a 5x5 themed mini crossword.

Title: "{title}"
Theme topics: {topics}

The puzzle must strongly reflect these topics.

Additional constraints:
- Longest Across entry must directly reference the theme.
- Avoid weak fill or crossword glue (e.g., "OREO", "ETTA", "ERA") unless absolutely necessary.
- Theme consistency is more important than clever grid density.
- Prefer fewer black squares if possible while maintaining validity.
- Ensure the grid and answers match perfectly.

Remember:
You must complete internal validation before returning the final JSON.
"""

        try:
            # Step 1: Generate
            logger.info(f"Generating puzzle with topics: {topics}")
            gen_response = await self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                response_format={ "type": "json_object" },
                temperature=0.7
            )
            
            raw_data = json.loads(gen_response.choices[0].message.content)
            
            # Step 2: Verify & Refine
            logger.info("Verifying and refining puzzle...")
            verify_system_prompt = """
You are a senior crossword editor. Your job is to review the provided 5x5 mini crossword for technical perfection and clue quality.
Verify:
1. Every Across and Down word in the 'answers' correctly matches the 'grid' letters at those positions.
2. The clues are factually accurate, clever, and correctly numbered.
3. The grid has 180-degree rotational symmetry.
4. The theme is strong and relates to the user's topics.

If you find errors (mismatched letters, broken symmetry, weak clues), fix them and return the corrected JSON.
If the puzzle is already perfect, return it exactly as is.
Return ONLY valid JSON.
"""
            verify_user_prompt = f"Review and refine this puzzle for the topics '{topics}':\n\n{json.dumps(raw_data)}"
            
            verify_response = await self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": verify_system_prompt},
                    {"role": "user", "content": verify_user_prompt}
                ],
                response_format={ "type": "json_object" },
                temperature=0.3
            )
            
            data = json.loads(verify_response.choices[0].message.content)
            
            # Final Safety: Recalculate gridnums to ensure they ALWAYS match the grid structure
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
                logger.info("Recalculated gridnums to ensure final consistency")

            return Puzzle.model_validate(data)
            
        except Exception as e:
            logger.error(f"Error generating crossword: {e}")
            return None
            
        except Exception as e:
            logger.error(f"Error generating crossword: {e}")
            return None
