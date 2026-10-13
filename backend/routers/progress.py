from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List

from deps import get_current_user, get_db
from models import user as User, ShowProgress, MovieProgress, EpisodePosition
from models import show as Show
from search import get_next_episode, cached_episode_runtimes

router = APIRouter()

MAX_EPISODES = 2000
# used when the real episode runtime isnt cached yet
EPISODE_MINUTES = 45


def _is_count(value, limit):
    return isinstance(value, int) and not isinstance(value, bool) and 0 <= value <= limit


class show_progress_update(BaseModel):
    show_id: int
    season_number: int
    episode_number: int
    watched: bool
    cascade: bool = False


class bulk_show_progress_update(BaseModel):
    show_id: int
    watched: bool = True
    seasons: List[dict] = []


class position_update(BaseModel):
    show_id: int
    season_number: int
    episode_number: int
    minutes: int = 0


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
    position = db_session.query(EpisodePosition).filter_by(user_id=current_user.id, show_id=show_id).first()
    return {
        'progress': [p.to_dict() for p in progress],
        'position': position.to_dict() if position else None,
    }


@router.post('/progress')
async def update_show_progress(
    body: show_progress_update,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    if body.season_number < 0 or not 1 <= body.episode_number <= MAX_EPISODES:
        raise HTTPException(status_code=400, detail='Invalid episode')

    season = db_session.query(ShowProgress).filter_by(
        user_id=current_user.id,
        show_id=body.show_id,
        season_number=body.season_number,
    ).all()
    by_episode = {p.episode_number: p for p in season}

    # cascade also ticks every episode before this one in the season
    first = 1 if body.cascade and body.watched else body.episode_number
    for ep_num in range(first, body.episode_number + 1):
        prog = by_episode.get(ep_num)
        if prog:
            prog.watched = body.watched
        else:
            prog = ShowProgress(
                user_id=current_user.id,
                show_id=body.show_id,
                season_number=body.season_number,
                episode_number=ep_num,
                watched=body.watched,
            )
            db_session.add(prog)

    # finishing the episode they stopped in clears the saved spot
    if body.watched:
        position = db_session.query(EpisodePosition).filter_by(user_id=current_user.id, show_id=body.show_id).first()
        if position and position.season_number == body.season_number and position.episode_number <= body.episode_number:
            db_session.delete(position)

    db_session.commit()
    return prog.to_dict()


@router.put('/position')
async def set_position(
    body: position_update,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    if body.season_number < 0 or not 1 <= body.episode_number <= MAX_EPISODES:
        raise HTTPException(status_code=400, detail='Invalid episode')
    if not 0 <= body.minutes <= 1000:
        raise HTTPException(status_code=400, detail='Invalid minutes')

    position = db_session.query(EpisodePosition).filter_by(user_id=current_user.id, show_id=body.show_id).first()
    if not position:
        position = EpisodePosition(user_id=current_user.id, show_id=body.show_id)
        db_session.add(position)
    position.season_number = body.season_number
    position.episode_number = body.episode_number
    position.minutes = body.minutes
    db_session.commit()
    return position.to_dict()


@router.delete('/position/{show_id}')
async def clear_position(
    show_id: int,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    db_session.query(EpisodePosition).filter_by(user_id=current_user.id, show_id=show_id).delete()
    db_session.commit()
    return {'message': 'Position cleared'}


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

    positions = db_session.query(EpisodePosition).filter_by(user_id=current_user.id).all()
    positions_map = {p.show_id: p.to_dict() for p in positions}

    return {'shows': shows_map, 'movies': movies_map, 'positions': positions_map}


@router.get('/stats/{user_id}')
async def get_watch_stats(
    user_id: int,
    tz: int = 0,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    # tz is the viewers offset from utc in minutes, so days match their calendar
    offset = timedelta(minutes=max(-840, min(840, tz)))
    days = {}

    def add(when, minutes):
        if not when:
            return
        day = (when + offset).date().isoformat()
        entry = days.setdefault(day, {'date': day, 'count': 0, 'minutes': 0})
        entry['count'] += 1
        entry['minutes'] += minutes

    episodes = db_session.query(ShowProgress).filter_by(user_id=user_id, watched=True).all()
    runtimes = {}
    for ep in episodes:
        season = (ep.show_id, ep.season_number)
        if season not in runtimes:
            runtimes[season] = cached_episode_runtimes(ep.show_id, ep.season_number)
        add(ep.created_at, runtimes[season].get(ep.episode_number) or EPISODE_MINUTES)

    movies = db_session.query(MovieProgress).filter(
        MovieProgress.user_id == user_id, MovieProgress.watched_minutes > 0
    ).all()
    for m in movies:
        add(m.updated_at or m.created_at, m.watched_minutes)

    # days in a row, counting back from today (or yesterday if nothing today yet)
    day = (datetime.utcnow() + offset).date()
    if day.isoformat() not in days:
        day -= timedelta(days=1)
    streak = 0
    while day.isoformat() in days:
        streak += 1
        day -= timedelta(days=1)

    return {
        'episodes': len(episodes),
        'movies': len(movies),
        'minutes': sum(d['minutes'] for d in days.values()),
        'streak': streak,
        'heatmap': sorted(days.values(), key=lambda d: d['date']),
    }


@router.get('/upcoming')
def get_upcoming(
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    # next episode for every show in the users lists that is still airing
    shows = db_session.query(Show).filter_by(user_id=current_user.id).limit(80).all()
    today = (datetime.utcnow() - timedelta(days=1)).date().isoformat()
    seen = set()
    upcoming = []
    for s in shows:
        if not s.tmdb_id or s.tmdb_id in seen:
            continue
        seen.add(s.tmdb_id)
        nxt = get_next_episode(s.tmdb_id)
        if nxt and nxt['air_date'] >= today:
            upcoming.append({'show_id': s.tmdb_id, 'title': s.title, 'poster_url': s.poster_url, **nxt})
    upcoming.sort(key=lambda e: e['air_date'])
    return {'episodes': upcoming}


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
    if len(body.seasons) > 200:
        raise HTTPException(status_code=400, detail='Too many seasons')
    for season in body.seasons:
        season_number = season.get('season_number')
        episode_count = season.get('episode_count', 0)
        if not _is_count(season_number, 1000) or not _is_count(episode_count, MAX_EPISODES):
            raise HTTPException(status_code=400, detail='Each season needs season_number and episode_count as integers')

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
    if not 0 <= body.total_minutes <= 100000 or body.watched_minutes < 0:
        raise HTTPException(status_code=400, detail='Invalid minutes')
    if body.total_minutes:
        body.watched_minutes = min(body.watched_minutes, body.total_minutes)
    body.watched_minutes = min(body.watched_minutes, 100000)

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
