from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from slowapi import Limiter
from slowapi.util import get_remote_address
from ..dependencies import get_db, get_current_user
from ..services.room_service import RoomService
from ..services.ably_service import ably_service

router = APIRouter(prefix="/api/rooms", tags=["rooms"])
limiter = Limiter(key_func=get_remote_address)


class CreateRoomRequest(BaseModel):
    puzzle_id: str
    puzzle_data: dict


class UpdateColorRequest(BaseModel):
    color: str


class UpdateStateRequest(BaseModel):
    userGrid: Optional[list] = None
    checkedCells: Optional[list] = None
    accumulatedSeconds: Optional[int] = None
    timerStartedAt: Optional[str] = None
    isComplete: Optional[bool] = None
    isPaused: Optional[bool] = None


@router.post("")
@limiter.limit("10/minute")
async def create_room(
    request: Request,
    body: CreateRoomRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new collaborative room for a puzzle."""
    service = RoomService(db)
    # Fetch user's display name
    from ..db.models import User
    from sqlalchemy import select

    result = await db.execute(select(User).where(User.id == current_user["id"]))
    user = result.scalar_one_or_none()
    display_name = user.name if user else current_user["email"]

    room = await service.create_room(
        user_id=current_user["id"],
        puzzle_id=body.puzzle_id,
        puzzle_data=body.puzzle_data,
        display_name=display_name,
    )
    return room


@router.get("/{code}")
async def get_room(
    code: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get room info and members list."""
    service = RoomService(db)
    room = await service.get_room(code.upper())
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if room.get("expired"):
        raise HTTPException(status_code=410, detail="Room has expired")
    return room


@router.post("/{code}/join")
@limiter.limit("10/minute")
async def join_room(
    request: Request,
    code: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Join an existing room."""
    service = RoomService(db)

    from ..db.models import User
    from sqlalchemy import select

    result = await db.execute(select(User).where(User.id == current_user["id"]))
    user = result.scalar_one_or_none()
    display_name = user.name if user else current_user["email"]

    join_result = await service.join_room(code.upper(), current_user["id"], display_name)
    if not join_result:
        raise HTTPException(status_code=404, detail="Room not found")
    if join_result.get("expired"):
        raise HTTPException(status_code=410, detail="Room has expired")
    if join_result.get("full"):
        raise HTTPException(status_code=409, detail="Room is full")
    return join_result


@router.post("/{code}/leave")
async def leave_room(
    code: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Leave a room."""
    service = RoomService(db)
    success = await service.leave_room(code.upper(), current_user["id"])
    if not success:
        raise HTTPException(status_code=404, detail="Room or membership not found")
    return {"status": "left"}


@router.put("/{code}/color")
async def update_color(
    code: str,
    body: UpdateColorRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the current user's color in a room."""
    service = RoomService(db)
    result = await service.update_member_color(code.upper(), current_user["id"], body.color)
    if not result:
        raise HTTPException(status_code=404, detail="Room, member, or color not found")
    if result.get("taken"):
        raise HTTPException(status_code=409, detail="Color already taken by another member")
    return result


@router.post("/{code}/token")
@limiter.limit("20/minute")
async def get_ably_token(
    request: Request,
    code: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get an Ably auth token scoped to this room's channel. Must be a member."""
    service = RoomService(db)
    is_member = await service.is_member(code.upper(), current_user["id"])
    if not is_member:
        raise HTTPException(status_code=403, detail="Not a member of this room")

    try:
        channel = f"room:{code.upper()}"
        token_request = await ably_service.create_token_request(
            client_id=str(current_user["id"]),
            channel=channel,
        )
        return token_request
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/{code}/state")
async def get_room_state(
    code: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current room grid state (for late joiners)."""
    service = RoomService(db)
    is_member = await service.is_member(code.upper(), current_user["id"])
    if not is_member:
        raise HTTPException(status_code=403, detail="Not a member of this room")

    state = await service.get_room_state(code.upper())
    if not state:
        raise HTTPException(status_code=404, detail="Room not found")
    return state


@router.put("/{code}/state")
async def update_room_state(
    code: str,
    body: UpdateStateRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Persist current grid state (debounced from client)."""
    service = RoomService(db)
    is_member = await service.is_member(code.upper(), current_user["id"])
    if not is_member:
        raise HTTPException(status_code=403, detail="Not a member of this room")

    success = await service.update_room_state(code.upper(), body.model_dump(exclude_none=True))
    if not success:
        raise HTTPException(status_code=404, detail="Room not found")
    return {"status": "updated"}
