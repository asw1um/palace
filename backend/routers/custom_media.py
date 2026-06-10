from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List

from deps import get_current_user, get_db
from models import CustomMedia, user as User

router = APIRouter()


class custom_media_update(BaseModel):
    runtime: int | None = None
    seasons: List[dict] | None = None


@router.get('/{media_type}/{tmdb_id}')
async def get_meta(
    media_type: str,
    tmdb_id: int,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    if media_type not in ('movie', 'tv'):
        raise HTTPException(status_code=400, detail='Invalid media type')
    row = db_session.query(CustomMedia).filter_by(
        user_id=current_user.id, tmdb_id=tmdb_id, media_type=media_type
    ).first()
    return row.to_dict() if row else None


@router.put('/{media_type}/{tmdb_id}')
async def set_meta(
    media_type: str,
    tmdb_id: int,
    body: custom_media_update,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    if media_type not in ('movie', 'tv'):
        raise HTTPException(status_code=400, detail='Invalid media type')

    row = db_session.query(CustomMedia).filter_by(
        user_id=current_user.id, tmdb_id=tmdb_id, media_type=media_type
    ).first()
    if row is None:
        row = CustomMedia(user_id=current_user.id, tmdb_id=tmdb_id, media_type=media_type)
        db_session.add(row)

    if media_type == 'movie' and body.runtime is not None:
        if body.runtime <= 0:
            raise HTTPException(status_code=400, detail='Runtime must be greater than 0')
        row.runtime = body.runtime

    if media_type == 'tv' and body.seasons is not None:
        if not body.seasons:
            raise HTTPException(status_code=400, detail='seasons must be a non-empty list')
        for s in body.seasons:
            if not isinstance(s.get('season_number'), int) or not isinstance(s.get('episode_count'), int):
                raise HTTPException(status_code=400, detail='Each season needs season_number and episode_count as integers')
        row.seasons = body.seasons

    db_session.commit()
    return row.to_dict()
