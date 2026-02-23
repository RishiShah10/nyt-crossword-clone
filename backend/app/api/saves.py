from __future__ import annotations
import re
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from ..dependencies import get_db, get_current_user
from ..services.saves_service import SavesService

router = APIRouter(prefix="/api/saves", tags=["saves"])

PUZZLE_ID_PATTERN = re.compile(r"^[\w\-]{1,50}$")


class SaveRequest(BaseModel):
    user_grid: list = Field(default_factory=list, max_length=2000)
    checked_cells: list = Field(default_factory=list, max_length=2000)
    elapsed_seconds: int = Field(default=0, ge=0, le=360000)
    is_complete: bool = False
    cells_filled: int = Field(default=0, ge=0, le=10000)
    total_cells: int = Field(default=0, ge=0, le=10000)
    completion_pct: int = Field(default=0, ge=0, le=100)
    puzzle_date: str = Field(default="", max_length=50)


class BulkSaveItem(BaseModel):
    puzzle_id: str = Field(..., min_length=1, max_length=50)
    user_grid: list = Field(default_factory=list, max_length=2000)
    checked_cells: list = Field(default_factory=list, max_length=2000)
    elapsed_seconds: int = Field(default=0, ge=0, le=360000)
    is_complete: bool = False
    cells_filled: int = Field(default=0, ge=0, le=10000)
    total_cells: int = Field(default=0, ge=0, le=10000)
    completion_pct: int = Field(default=0, ge=0, le=100)
    puzzle_date: str = Field(default="", max_length=50)


class BulkImportRequest(BaseModel):
    saves: List[BulkSaveItem] = Field(..., max_length=100)


def _validate_puzzle_id(puzzle_id: str) -> str:
    if not PUZZLE_ID_PATTERN.match(puzzle_id):
        raise HTTPException(status_code=400, detail="Invalid puzzle ID format")
    return puzzle_id


@router.get("")
async def list_saves(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all saves for the current user."""
    service = SavesService(db)
    return await service.list_saves(current_user["id"])


@router.post("/bulk")
async def bulk_import(
    data: BulkImportRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Bulk import saves (for localStorage migration). Max 100 saves."""
    service = SavesService(db)
    count = await service.bulk_import(current_user["id"], [s.model_dump() for s in data.saves])
    return {"imported": count}


@router.get("/{puzzle_id:path}")
async def get_save(
    puzzle_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get full save data for a puzzle."""
    puzzle_id = _validate_puzzle_id(puzzle_id)
    service = SavesService(db)
    save = await service.get_save(current_user["id"], puzzle_id)
    if not save:
        raise HTTPException(status_code=404, detail="Save not found")
    return save


@router.put("/{puzzle_id:path}")
async def upsert_save(
    puzzle_id: str,
    data: SaveRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create or update a save."""
    puzzle_id = _validate_puzzle_id(puzzle_id)
    service = SavesService(db)
    return await service.upsert_save(current_user["id"], puzzle_id, data.model_dump())


@router.delete("/{puzzle_id:path}")
async def delete_save(
    puzzle_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a save."""
    puzzle_id = _validate_puzzle_id(puzzle_id)
    service = SavesService(db)
    deleted = await service.delete_save(current_user["id"], puzzle_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Save not found")
    return {"status": "deleted"}
