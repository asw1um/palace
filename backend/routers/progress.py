from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List

from deps import get_current_user, get_db
from models import user as User, ShowProgress, MovieProgress

router = APIRouter()


class show_progress_update(BaseModel):
    show_id: int
    season_number: int
    episode_number: int
    watched: bool


class bulk_show_progress_update(BaseModel):
    show_id: int
    watched: bool = True
    seasons: List[dict] = []


class movie_progress_update(BaseModel):
    movie_id: int
    watched_minutes: int = 0
    total_minutes: int = 0


@router.get('/progress/{show_id}')
async def get_show_progress(
    show_id: int,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    progress = db_session.query(ShowProgress).filter_by(user_id=current_user.id, show_id=show_id).all()
    return {'progress': [p.to_dict() for p in progress]}


@router.post('/progress')
async def update_show_progress(
    body: show_progress_update,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    prog = db_session.query(ShowProgress).filter_by(
        user_id=current_user.id,
        show_id=body.show_id,
        season_number=body.season_number,
        episode_number=body.episode_number,
    ).first()

    if prog:
        prog.watched = body.watched
    else:
        prog = ShowProgress(
            user_id=current_user.id,
            show_id=body.show_id,
            season_number=body.season_number,
            episode_number=body.episode_number,
            watched=body.watched,
        )
        db_session.add(prog)

    db_session.commit()
    return prog.to_dict()


@router.get('/all-progress')
async def get_all_progress(
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    show_entries = db_session.query(ShowProgress).filter_by(user_id=current_user.id).all()
    shows_map: dict = {}
    for entry in show_entries:
        if entry.show_id not in shows_map:
            shows_map[entry.show_id] = {}
        shows_map[entry.show_id][f"{entry.season_number}-{entry.episode_number}"] = entry.watched

    movie_entries = db_session.query(MovieProgress).filter_by(user_id=current_user.id).all()
    movies_map = {entry.movie_id: entry.to_dict() for entry in movie_entries}

    return {'shows': shows_map, 'movies': movies_map}


@router.get('/movie-progress/{movie_id}')
async def get_movie_progress(
    movie_id: int,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    prog = db_session.query(MovieProgress).filter_by(user_id=current_user.id, movie_id=movie_id).first()
    return prog.to_dict() if prog else {'watched_minutes': 0, 'total_minutes': 0}


@router.post('/bulk-show-progress')
async def bulk_update_show_progress(
    body: bulk_show_progress_update,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    for season in body.seasons:
        season_number = season.get('season_number')
        episode_count = season.get('episode_count', 0)
        for ep_num in range(1, episode_count + 1):
            existing = db_session.query(ShowProgress).filter_by(
                user_id=current_user.id,
                show_id=body.show_id,
                season_number=season_number,
                episode_number=ep_num,
            ).first()
            if existing:
                existing.watched = body.watched
            else:
                db_session.add(ShowProgress(
                    user_id=current_user.id,
                    show_id=body.show_id,
                    season_number=season_number,
                    episode_number=ep_num,
                    watched=body.watched,
                ))
    db_session.commit()
    return {'message': 'Progress updated'}


@router.post('/movie-progress')
async def update_movie_progress(
    body: movie_progress_update,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    prog = db_session.query(MovieProgress).filter_by(user_id=current_user.id, movie_id=body.movie_id).first()
    if prog:
        prog.watched_minutes = body.watched_minutes
        prog.total_minutes = body.total_minutes
    else:
        prog = MovieProgress(
            user_id=current_user.id,
            movie_id=body.movie_id,
            watched_minutes=body.watched_minutes,
            total_minutes=body.total_minutes,
        )
        db_session.add(prog)
    db_session.commit()
    return prog.to_dict()
