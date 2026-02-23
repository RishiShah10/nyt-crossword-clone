from __future__ import annotations
import random
import string
from datetime import datetime, timezone
from uuid import UUID
from typing import Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from ..db.models import Room, RoomMember, User

# Characters excluding ambiguous ones: 0/O, 1/I/L
CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 6

MEMBER_COLORS = ["#4A90D9", "#E74C3C", "#2ECC71", "#9B59B6"]


class RoomService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _generate_unique_code(self) -> str:
        """Generate a unique 6-character room code."""
        for _ in range(20):
            code = "".join(random.choices(CODE_CHARS, k=CODE_LENGTH))
            result = await self.db.execute(
                select(Room).where(Room.code == code)
            )
            if result.scalar_one_or_none() is None:
                return code
        raise RuntimeError("Failed to generate unique room code")

    async def create_room(
        self, user_id: UUID, puzzle_id: str, puzzle_data: dict, display_name: str
    ) -> dict:
        """Create a new room and add creator as first member."""
        code = await self._generate_unique_code()

        room = Room(
            code=code,
            puzzle_id=puzzle_id,
            puzzle_data=puzzle_data,
            created_by=user_id,
        )
        self.db.add(room)
        await self.db.flush()

        member = RoomMember(
            room_id=room.id,
            user_id=user_id,
            color=MEMBER_COLORS[0],
            display_name=display_name,
        )
        self.db.add(member)
        await self.db.commit()
        await self.db.refresh(room)

        return self._room_to_dict(room, [member])

    async def get_room(self, code: str) -> Optional[dict]:
        """Get room info by code, including members."""
        result = await self.db.execute(
            select(Room)
            .options(selectinload(Room.members))
            .where(Room.code == code)
        )
        room = result.scalar_one_or_none()
        if not room:
            return None

        # Check expiry
        if room.expires_at and room.expires_at < datetime.now(timezone.utc):
            return {"expired": True, "code": code}

        return self._room_to_dict(room, room.members)

    async def join_room(self, code: str, user_id: UUID, display_name: str) -> Optional[dict]:
        """Join a room. Returns member info or None if room not found."""
        result = await self.db.execute(
            select(Room)
            .options(selectinload(Room.members))
            .where(Room.code == code)
        )
        room = result.scalar_one_or_none()
        if not room:
            return None

        if room.expires_at and room.expires_at < datetime.now(timezone.utc):
            return {"expired": True}

        # Check if already a member (compare as strings to avoid UUID type mismatch)
        for m in room.members:
            if str(m.user_id) == str(user_id):
                return {
                    "room": self._room_to_dict(room, room.members),
                    "member": self._member_to_dict(m),
                    "already_joined": True,
                }

        # Check capacity
        if len(room.members) >= room.max_members:
            return {"full": True}

        # Assign next available color
        used_colors = {m.color for m in room.members}
        color = MEMBER_COLORS[0]
        for c in MEMBER_COLORS:
            if c not in used_colors:
                color = c
                break

        member = RoomMember(
            room_id=room.id,
            user_id=user_id,
            color=color,
            display_name=display_name,
        )
        self.db.add(member)
        await self.db.commit()
        await self.db.refresh(room)

        # Re-fetch to get updated members list
        result = await self.db.execute(
            select(Room)
            .options(selectinload(Room.members))
            .where(Room.id == room.id)
        )
        room = result.scalar_one()

        return {
            "room": self._room_to_dict(room, room.members),
            "member": self._member_to_dict(member),
        }

    async def leave_room(self, code: str, user_id: UUID) -> bool:
        """Remove a user from a room. Returns True if successful."""
        result = await self.db.execute(
            select(Room).where(Room.code == code)
        )
        room = result.scalar_one_or_none()
        if not room:
            return False

        result = await self.db.execute(
            select(RoomMember).where(
                RoomMember.room_id == room.id,
                RoomMember.user_id == str(user_id),
            )
        )
        member = result.scalar_one_or_none()
        if not member:
            return False

        await self.db.delete(member)
        await self.db.commit()
        return True

    async def is_member(self, code: str, user_id: UUID) -> bool:
        """Check if user is a member of room."""
        result = await self.db.execute(
            select(Room).where(Room.code == code)
        )
        room = result.scalar_one_or_none()
        if not room:
            return False

        result = await self.db.execute(
            select(RoomMember).where(
                RoomMember.room_id == room.id,
                RoomMember.user_id == str(user_id),
            )
        )
        return result.scalar_one_or_none() is not None

    async def get_room_state(self, code: str) -> Optional[dict]:
        """Get the current shared state for a room."""
        result = await self.db.execute(
            select(Room).where(Room.code == code)
        )
        room = result.scalar_one_or_none()
        if not room:
            return None

        return {
            "userGrid": room.user_grid or [],
            "checkedCells": room.checked_cells or [],
            "accumulatedSeconds": room.accumulated_seconds,
            "timerStartedAt": room.timer_started_at.isoformat() if room.timer_started_at else None,
            "isComplete": room.is_complete,
            "isPaused": room.is_paused,
            "puzzleData": room.puzzle_data,
        }

    async def update_room_state(self, code: str, state: dict) -> bool:
        """Persist shared grid state from a client."""
        result = await self.db.execute(
            select(Room).where(Room.code == code)
        )
        room = result.scalar_one_or_none()
        if not room:
            return False

        if "userGrid" in state:
            room.user_grid = state["userGrid"]
        if "checkedCells" in state:
            room.checked_cells = state["checkedCells"]
        if "accumulatedSeconds" in state:
            room.accumulated_seconds = state["accumulatedSeconds"]
        if "timerStartedAt" in state:
            val = state["timerStartedAt"]
            room.timer_started_at = datetime.fromisoformat(val) if val else None
        if "isComplete" in state:
            room.is_complete = state["isComplete"]
        if "isPaused" in state:
            room.is_paused = state["isPaused"]

        room.updated_at = datetime.now(timezone.utc)
        await self.db.commit()
        return True

    # --- helpers ---

    @staticmethod
    def _room_to_dict(room: Room, members: list[RoomMember]) -> dict:
        return {
            "id": str(room.id),
            "code": room.code,
            "puzzleId": room.puzzle_id,
            "puzzleData": room.puzzle_data,
            "isComplete": room.is_complete,
            "createdBy": str(room.created_by),
            "createdAt": room.created_at.isoformat() if room.created_at else None,
            "expiresAt": room.expires_at.isoformat() if room.expires_at else None,
            "members": [RoomService._member_to_dict(m) for m in members],
            "accumulatedSeconds": room.accumulated_seconds,
            "timerStartedAt": room.timer_started_at.isoformat() if room.timer_started_at else None,
            "isPaused": room.is_paused,
        }

    @staticmethod
    def _member_to_dict(member: RoomMember) -> dict:
        return {
            "userId": str(member.user_id),
            "displayName": member.display_name,
            "color": member.color,
            "joinedAt": member.joined_at.isoformat() if member.joined_at else None,
        }
