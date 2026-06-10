from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List

from deps import get_current_user, get_db
from models import user as User, show as Show, show_season, movielist
from search import getShow as fetch_show_details
from activity import log_event
from cache import lists_cache_invalidate

router = APIRouter()


class add_show_request(BaseModel):
    title: str
    poster: str | None = None
    tmdb_id: int
    list_ids: List[int] = []


class remove_show_request(BaseModel):
    list_id: int


class update_progress_request(BaseModel):
    season: int | None = None
    episode: int | None = None


@router.post('/shows/add')
async def add_show(
    body: add_show_request,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    if not body.list_ids:
        raise HTTPException(status_code=400, detail='Select at least one list')

    existing = db_session.query(Show).filter_by(user_id=current_user.id, tmdb_id=body.tmdb_id).first()
    if existing:
        new_show = existing
    else:
        new_show = Show(title=body.title, poster_url=body.poster, tmdb_id=body.tmdb_id, user_id=current_user.id)
        db_session.add(new_show)
        db_session.flush()

        show_details = fetch_show_details(body.tmdb_id)
        if show_details:
            new_show.total_seasons = show_details.get('number_of_seasons') or 0
            for season in show_details.get('seasons', []):
                db_session.add(show_season(
                    show_id=new_show.id,
                    season_number=season['season_number'],
                    episode_count=season['episode_count'],
                ))
        db_session.commit()

    added_to = []
    for list_id in body.list_ids:
        list_obj = db_session.get(movielist, list_id)
        if list_obj and list_obj.can_edit(current_user) and new_show not in list_obj.shows:
            list_obj.shows.append(new_show)
            added_to.append(list_obj)

    if added_to:
        db_session.commit()
        for list_obj in added_to:
            if list_obj.is_club_list():
                log_event(
                    event_type='user_in_club_added_show',
                    user_id=current_user.id,
                    club_id=list_obj.club_id,
                    list_id=list_obj.id,
                    show_id=new_show.id,
                    description=f"Added '{body.title}' to club list '{list_obj.name}'",
                    extra_data={'show_title': body.title, 'list_name': list_obj.name, 'club_name': list_obj.club.name},
                    session=db_session,
                )
            else:
                log_event(
                    event_type='user_added_show',
                    user_id=current_user.id,
                    list_id=list_obj.id,
                    show_id=new_show.id,
                    description=f"Added '{body.title}' to list '{list_obj.name}'",
                    extra_data={'show_title': body.title, 'list_name': list_obj.name},
                    session=db_session,
                )
        return {'message': f'Added {body.title} to {", ".join(l.name for l in added_to)}'}
    return {'message': f'{body.title} is already in those lists'}


@router.post('/shows/remove/{show_id}')
async def remove_show(
    show_id: int,
    body: remove_show_request,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    list_obj = db_session.get(movielist, body.list_id)
    if not list_obj:
        raise HTTPException(status_code=404)
    if not list_obj.can_edit(current_user):
        raise HTTPException(status_code=403, detail='No permission to edit this list')

    show_obj = db_session.get(Show, show_id)
    if not show_obj:
        raise HTTPException(status_code=404)

    if show_obj not in list_obj.shows:
        raise HTTPException(status_code=404, detail='Show not found in list')

    list_obj.shows.remove(show_obj)
    db_session.commit()

    if list_obj.is_club_list():
        log_event(
            event_type='user_in_club_removed_show',
            user_id=current_user.id,
            club_id=list_obj.club_id,
            list_id=list_obj.id,
            show_id=show_obj.id,
            description=f"Removed '{show_obj.title}' from club list '{list_obj.name}'",
            extra_data={'show_title': show_obj.title, 'list_name': list_obj.name, 'club_name': list_obj.club.name},
            session=db_session,
        )
    else:
        log_event(
            event_type='user_removed_show',
            user_id=current_user.id,
            list_id=list_obj.id,
            show_id=show_obj.id,
            description=f"Removed '{show_obj.title}' from list '{list_obj.name}'",
            extra_data={'show_title': show_obj.title, 'list_name': list_obj.name},
            session=db_session,
        )

    if not show_obj.show_lists:
        db_session.delete(show_obj)
        db_session.commit()

    return {'message': f'Removed {show_obj.title} from {list_obj.name}'}


@router.post('/shows/update-progress/{show_id}')
async def update_show_progress(
    show_id: int,
    body: update_progress_request,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    show_obj = db_session.query(Show).filter_by(id=show_id, user_id=current_user.id).first()
    if not show_obj:
        raise HTTPException(status_code=404)
    show_obj.current_season = body.season
    show_obj.current_episode = body.episode
    db_session.commit()
    lists_cache_invalidate(current_user.id)
    return {'message': f'Progress updated for {show_obj.title}', 'show': show_obj.to_dict(include_seasons=True)}


@router.get('/shows/my-shows')
async def get_my_shows(
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    user_shows = db_session.query(Show).filter_by(user_id=current_user.id).all()
    return {'shows': [s.to_dict(include_seasons=True) for s in user_shows]}


@router.get('/shows/{show_id}')
async def get_show(
    show_id: int,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    show_obj = db_session.query(Show).filter_by(id=show_id, user_id=current_user.id).first()
    if not show_obj:
        raise HTTPException(status_code=404)
    return show_obj.to_dict(include_seasons=True)


@router.get('/watching')
async def get_watching(
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    user_shows = db_session.query(Show).filter(
        Show.user_id == current_user.id,
        Show.current_season != None,
    ).all()

    watching = []
    for s in user_shows:
        if s.current_season > s.total_seasons:
            continue
        last_season = db_session.query(show_season).filter_by(show_id=s.id, season_number=s.total_seasons).first()
        last_ep = last_season.episode_count if last_season else 0
        if s.current_season == s.total_seasons and s.current_episode > last_ep:
            continue
        watching.append(s)

    return {'shows': [s.to_dict(include_seasons=True) for s in watching]}
