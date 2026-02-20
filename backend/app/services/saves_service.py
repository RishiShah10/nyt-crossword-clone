from __future__ import annotations
from uuid import UUID
from typing import Optional
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert
from ..db.models import Save


class SavesService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_saves(self, user_id: UUID) -> list[dict]:
        """Get all saves metadata for a user."""
        result = await self.db.execute(
            select(
                Save.puzzle_id,
                Save.puzzle_date,
                Save.elapsed_seconds,
                Save.is_complete,
                Save.cells_filled,
                Save.total_cells,
                Save.completion_pct,
                Save.created_at,
                Save.updated_at,
            ).where(Save.user_id == user_id)
            .order_by(Save.updated_at.desc())
        )
        rows = result.all()
        return [
            {
                "puzzleId": row.puzzle_id,
                "date": row.puzzle_date or row.puzzle_id,
                "dateStarted": row.created_at.isoformat() if row.created_at else "",
                "lastPlayed": row.updated_at.isoformat() if row.updated_at else "",
                "elapsedSeconds": row.elapsed_seconds,
                "isComplete": row.is_complete,
                "cellsFilled": row.cells_filled,
                "totalCells": row.total_cells,
                "completionPercent": row.completion_pct,
            }
            for row in rows
        ]

    async def get_save(self, user_id: UUID, puzzle_id: str) -> dict | None:
        """Get full save data for a specific puzzle."""
        result = await self.db.execute(
            select(Save).where(Save.user_id == user_id, Save.puzzle_id == puzzle_id)
        )
        save = result.scalar_one_or_none()
        if not save:
            return None
        return {
            "puzzleId": save.puzzle_id,
            "userGrid": save.user_grid,
            "checkedCells": save.checked_cells,
            "elapsedSeconds": save.elapsed_seconds,
            "isComplete": save.is_complete,
            "cellsFilled": save.cells_filled,
            "totalCells": save.total_cells,
            "completionPct": save.completion_pct,
            "lastPlayed": save.updated_at.isoformat() if save.updated_at else "",
        }

    async def upsert_save(self, user_id: UUID, puzzle_id: str, data: dict) -> dict:
        """Create or update a save."""
        stmt = insert(Save).values(
            user_id=user_id,
            puzzle_id=puzzle_id,
            user_grid=data.get("user_grid", []),
            checked_cells=data.get("checked_cells", []),
            elapsed_seconds=data.get("elapsed_seconds", 0),
            is_complete=data.get("is_complete", False),
            cells_filled=data.get("cells_filled", 0),
            total_cells=data.get("total_cells", 0),
            completion_pct=data.get("completion_pct", 0),
            puzzle_date=data.get("puzzle_date", puzzle_id),
        ).on_conflict_do_update(
            constraint="uq_user_puzzle",
            set_={
                "user_grid": data.get("user_grid", []),
                "checked_cells": data.get("checked_cells", []),
                "elapsed_seconds": data.get("elapsed_seconds", 0),
                "is_complete": data.get("is_complete", False),
                "cells_filled": data.get("cells_filled", 0),
                "total_cells": data.get("total_cells", 0),
                "completion_pct": data.get("completion_pct", 0),
                "puzzle_date": data.get("puzzle_date", puzzle_id),
            },
        )
        await self.db.execute(stmt)
        await self.db.commit()
        return {"status": "saved", "puzzle_id": puzzle_id}

    async def delete_save(self, user_id: UUID, puzzle_id: str) -> bool:
        """Delete a save."""
        result = await self.db.execute(
            delete(Save).where(Save.user_id == user_id, Save.puzzle_id == puzzle_id)
        )
        await self.db.commit()
        return result.rowcount > 0

    async def bulk_import(self, user_id: UUID, saves: list[dict]) -> int:
        """Bulk import saves. Returns count of imported saves."""
        count = 0
        for save_data in saves:
            puzzle_id = save_data.get("puzzle_id", "")
            if not puzzle_id:
                continue
            await self.upsert_save(user_id, puzzle_id, save_data)
            count += 1
        return count
