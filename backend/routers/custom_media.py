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


@router.get('')
@router.get('/')
async def get_all_meta(
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    rows = db_session.query(CustomMedia).filter_by(user_id=current_user.id).all()
    return {'items': [row.to_dict() for row in rows]}


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
        if not 0 < body.runtime <= 1500:
            raise HTTPException(status_code=400, detail='Runtime must be between 1 and 1500 minutes')
        row.runtime = body.runtime

    if media_type == 'tv' and body.seasons is not None:
        if not body.seasons or len(body.seasons) > 100:
            raise HTTPException(status_code=400, detail='seasons must be a list of 1 to 100 seasons')
        for s in body.seasons:
            if not isinstance(s.get('season_number'), int) or not isinstance(s.get('episode_count'), int):
                raise HTTPException(status_code=400, detail='Each season needs season_number and episode_count as integers')
            if not 0 <= s['season_number'] <= 1000 or not 1 <= s['episode_count'] <= 2000:
                raise HTTPException(status_code=400, detail='Season numbers go up to 1000 and episode counts from 1 to 2000')
        body.seasons = [{'season_number': s['season_number'], 'episode_count': s['episode_count']} for s in body.seasons]
        row.seasons = body.seasons

    db_session.commit()
    return row.to_dict()


@router.delete('/{media_type}/{tmdb_id}')
async def reset_meta(
    media_type: str,
    tmdb_id: int,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    # back to whatever tmdb says
    db_session.query(CustomMedia).filter_by(
        user_id=current_user.id, tmdb_id=tmdb_id, media_type=media_type
    ).delete()
    db_session.commit()
    return {'message': 'Custom data removed'}
