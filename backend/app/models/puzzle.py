from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class PuzzleMetadata(BaseModel):
    """Metadata for a crossword puzzle."""
    title: Optional[str] = None
    author: Optional[str] = None
    editor: Optional[str] = None
    copyright: Optional[str] = None
    publisher: Optional[str] = None
    date: Optional[str] = None
    dow: Optional[str] = None  # Day of week


class Puzzle(BaseModel):
    """Complete crossword puzzle data model matching NYT JSON format."""

    # Grid dimensions
    size: Dict[str, int] = Field(description="Grid dimensions with 'rows' and 'cols' keys")

    # Grid data
    grid: List[str] = Field(description="Flat array of letters, '.' for black squares")
    gridnums: List[int] = Field(description="Clue numbers for each cell, 0 if no number")

    # Clues
    clues: Dict[str, List[str]] = Field(description="Clues organized by 'across' and 'down'")

    # Answers
    answers: Dict[str, List[str]] = Field(description="Answers organized by 'across' and 'down'")

    # Metadata
    author: Optional[str] = None
    editor: Optional[str] = None
    copyright: Optional[str] = None
    publisher: Optional[str] = None
    date: Optional[str] = None
    dow: Optional[str] = None
    title: Optional[str] = None

    # Additional fields that might be in the JSON
    circles: Optional[List[int]] = None
    shades: Optional[List[int]] = None
    notepad: Optional[str] = None
    jnotes: Optional[str] = None

    @property
    def rows(self) -> int:
        """Get number of rows in the grid."""
        return self.size.get("rows", 0)

    @property
    def cols(self) -> int:
        """Get number of columns in the grid."""
        return self.size.get("cols", 0)

    def validate_grid(self) -> bool:
        """Validate that grid dimensions match the data."""
        expected_length = self.rows * self.cols
        return (
            len(self.grid) == expected_length and
            len(self.gridnums) == expected_length
        )


class PuzzleResponse(BaseModel):
    """Response model for puzzle API endpoints."""
    puzzle: Puzzle
    puzzle_id: str  # Date in YYYY-MM-DD format
