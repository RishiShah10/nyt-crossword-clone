from __future__ import annotations
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from ..dependencies import get_db, get_current_user
from ..services.saves_service import SavesService

router = APIRouter(prefix="/api/saves", tags=["saves"])


class SaveRequest(BaseModel):
    user_grid: list = []
    checked_cells: list = []
    elapsed_seconds: int = 0
    is_complete: bool = False
    cells_filled: int = 0
    total_cells: int = 0
    completion_pct: int = 0
    puzzle_date: str = ""


class BulkImportRequest(BaseModel):
    saves: List[dict]


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
    """Bulk import saves (for localStorage migration)."""
    service = SavesService(db)
    count = await service.bulk_import(current_user["id"], data.saves)
    return {"imported": count}


@router.get("/{puzzle_id:path}")
async def get_save(
    puzzle_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get full save data for a puzzle."""
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
    service = SavesService(db)
    return await service.upsert_save(current_user["id"], puzzle_id, data.model_dump())


@router.delete("/{puzzle_id:path}")
async def delete_save(
    puzzle_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a save."""
    service = SavesService(db)
    deleted = await service.delete_save(current_user["id"], puzzle_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Save not found")
    return {"status": "deleted"}
