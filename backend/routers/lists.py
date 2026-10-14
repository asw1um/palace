import secrets

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import Any

from deps import get_current_user, get_db
from models import user as User, movielist, ListShare
from models import movie as MovieModel, show as ShowModel, show_season
from activity import log_event
from cache import lists_cache_get, lists_cache_set, lists_cache_invalidate
from search import getShow as fetch_show_details

router = APIRouter()


class create_list_request(BaseModel):
    name: str


class rename_list_request(BaseModel):
    name: str


class add_to_list_request(BaseModel):
    movie: dict


def _check_list_name(db_session, name, user_id, skip_id=None):
    if len(name) > 50:
        raise HTTPException(status_code=400, detail='List name must be 50 characters or fewer')
    taken = db_session.query(movielist).filter(
        movielist.user_id == user_id, func.lower(movielist.name) == name.lower()
    ).first()
    if taken and taken.id != skip_id:
        raise HTTPException(status_code=409, detail='You already have a list with that name')


@router.get('')
@router.get('/')
async def get_user_lists(
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    user_lists = db_session.query(movielist).filter_by(user_id=current_user.id).all()
    return {'lists': [lst.to_dict() for lst in user_lists]}


@router.get('/with-movies')
async def get_user_lists_with_movies(
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    cached = lists_cache_get(current_user.id)
    if cached is not None:
        return {'lists': cached}
    user_lists = db_session.query(movielist).filter_by(user_id=current_user.id).all()
    result = [lst.to_dict(include_movies=True, include_shows=True) for lst in user_lists]
    lists_cache_set(current_user.id, result)
    return {'lists': result}


@router.post('', status_code=201)
@router.post('/', status_code=201)
async def create_list(
    body: create_list_request,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail='List name cannot be empty')
    _check_list_name(db_session, name, current_user.id)

    new_list = movielist(name=name, user_id=current_user.id)
    db_session.add(new_list)
    db_session.commit()
    lists_cache_invalidate(current_user.id)

    log_event(
        event_type='user_created_list',
        user_id=current_user.id,
        list_id=new_list.id,
        description=f"{current_user.display_name} created list: {name}",
        extra_data={'list_name': name},
        session=db_session,
    )
    return {'message': f'Created list: {name}', 'list': new_list.to_dict()}


@router.get('/pinned')
async def get_pinned_lists(
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    pinned_ids = current_user.pinned_list_ids or []
    pinned = db_session.query(movielist).filter(movielist.id.in_(pinned_ids)).all()
    return {'lists': [lst.to_dict(include_movies=True, include_shows=True) for lst in pinned]}


@router.get('/{list_id}')
async def get_list(
    list_id: int,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    list_obj = db_session.get(movielist, list_id)
    if not list_obj:
        raise HTTPException(status_code=404)
    if list_obj.is_personal_list() and list_obj.user_id != current_user.id:
        raise HTTPException(status_code=403, detail='You do not have permission to view this list')
    if list_obj.is_club_list() and not list_obj.club.is_member(current_user):
        raise HTTPException(status_code=403, detail='You must be a club member to view this list')
    data = list_obj.to_dict(include_movies=True, include_shows=True)
    share = db_session.query(ListShare).filter_by(list_id=list_obj.id).first()
    data['share_token'] = share.token if share else None
    return {'list': data}


def _can_share(list_obj, user):
    if list_obj.is_club_list():
        return list_obj.club.can_manage(user)
    return list_obj.user_id == user.id


@router.post('/{list_id}/share')
async def share_list(
    list_id: int,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    list_obj = db_session.get(movielist, list_id)
    if not list_obj:
        raise HTTPException(status_code=404)
    if not _can_share(list_obj, current_user):
        raise HTTPException(status_code=403, detail='No permission to share this list')

    share = db_session.query(ListShare).filter_by(list_id=list_id).first()
    if not share:
        share = ListShare(list_id=list_id, token=secrets.token_urlsafe(16))
        db_session.add(share)
        db_session.commit()
    return {'token': share.token}


@router.delete('/{list_id}/share')
async def unshare_list(
    list_id: int,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    list_obj = db_session.get(movielist, list_id)
    if not list_obj:
        raise HTTPException(status_code=404)
    if not _can_share(list_obj, current_user):
        raise HTTPException(status_code=403, detail='No permission to share this list')
    db_session.query(ListShare).filter_by(list_id=list_id).delete()
    db_session.commit()
    return {'message': 'Link removed'}


@router.delete('/{list_id}')
async def delete_list(
    list_id: int,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    list_obj = db_session.get(movielist, list_id)
    if not list_obj:
        raise HTTPException(status_code=404)
    if list_obj.user_id != current_user.id:
        raise HTTPException(status_code=403, detail='Not your list')

    log_event(
        event_type='user_deleted_list',
        user_id=current_user.id,
        list_id=list_obj.id,
        description=f"Deleted list: {list_obj.name}",
        extra_data={'list_name': list_obj.name},
        session=db_session,
    )
    db_session.query(ListShare).filter_by(list_id=list_obj.id).delete()
    db_session.delete(list_obj)
    db_session.commit()
    lists_cache_invalidate(current_user.id)
    return {'message': 'list deleted'}


@router.post('/{list_id}/rename')
@router.put('/{list_id}/rename')
async def rename_list(
    list_id: int,
    body: rename_list_request,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    list_obj = db_session.get(movielist, list_id)
    if not list_obj:
        raise HTTPException(status_code=404)
    if list_obj.user_id != current_user.id:
        raise HTTPException(status_code=403, detail='Not your list')

    new_name = body.name.strip()
    if not new_name:
        raise HTTPException(status_code=400, detail='Name cannot be empty')
    _check_list_name(db_session, new_name, current_user.id, skip_id=list_obj.id)

    old_name = list_obj.name
    list_obj.name = new_name
    db_session.commit()
    lists_cache_invalidate(current_user.id)

    log_event(
        event_type='user_renamed_list',
        user_id=current_user.id,
        list_id=list_obj.id,
        description=f"Renamed list from '{old_name}' to '{new_name}'",
        extra_data={'old_name': old_name, 'new_name': new_name},
        session=db_session,
    )
    return {'message': f'Renamed list to: {new_name}', 'list': list_obj.to_dict()}


@router.post('/{list_id}/pin')
async def pin_list(
    list_id: int,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    list_obj = db_session.get(movielist, list_id)
    if not list_obj:
        raise HTTPException(status_code=404)
    if list_obj.is_personal_list() and list_obj.user_id != current_user.id:
        raise HTTPException(status_code=403, detail='Not your list')
    if list_obj.is_club_list() and not list_obj.club.is_member(current_user):
        raise HTTPException(status_code=403, detail='Must be a club member')

    pinned = list(current_user.pinned_list_ids or [])
    if list_id not in pinned:
        if len(pinned) >= 4:
            raise HTTPException(status_code=400, detail='Maximum of 4 pinned lists allowed')
        current_user.pinned_list_ids = pinned + [list_id]
        db_session.commit()
    return {'message': 'List pinned'}


@router.post('/{list_id}/unpin')
async def unpin_list(
    list_id: int,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    pinned = list(current_user.pinned_list_ids or [])
    if list_id in pinned:
        current_user.pinned_list_ids = [pid for pid in pinned if pid != list_id]
        db_session.commit()
    return {'message': 'List unpinned'}


@router.post('/{list_id}/add')
async def add_to_list(
    list_id: int,
    body: add_to_list_request,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    list_obj = db_session.get(movielist, list_id)
    if not list_obj:
        raise HTTPException(status_code=404)
    if not list_obj.can_edit(current_user):
        raise HTTPException(status_code=403, detail='No permission to edit this list')

    movie_data = body.movie
    tmdb_id = movie_data.get('tmdb_id') or movie_data.get('id')
    title = movie_data.get('title')
    poster_url = movie_data.get('poster_url') or movie_data.get('poster')
    media_type = movie_data.get('media_type', 'movie')

    if not isinstance(tmdb_id, int) or isinstance(tmdb_id, bool) or tmdb_id <= 0:
        raise HTTPException(status_code=400, detail='Invalid tmdb_id')
    if not isinstance(title, str) or not title.strip() or len(title) > 200:
        raise HTTPException(status_code=400, detail='Invalid title')
    if media_type not in ('movie', 'tv'):
        raise HTTPException(status_code=400, detail='Invalid media type')
    if poster_url is not None and (not isinstance(poster_url, str) or len(poster_url) > 300):
        raise HTTPException(status_code=400, detail='Invalid poster')

    if media_type == 'tv':
        existing = db_session.query(ShowModel).filter_by(user_id=current_user.id, tmdb_id=tmdb_id).first()
        if existing:
            show_obj = existing
        else:
            # fetch first, flushing before this locks sqlite for the cache write
            show_details = fetch_show_details(tmdb_id)
            if not show_details:
                raise HTTPException(status_code=404, detail='Show not found')
            show_obj = ShowModel(title=title, poster_url=poster_url, tmdb_id=tmdb_id, user_id=current_user.id)
            db_session.add(show_obj)
            db_session.flush()
            if show_details:
                show_obj.total_seasons = show_details.get('number_of_seasons') or 0
                for season in show_details.get('seasons', []):
                    db_session.add(show_season(
                        show_id=show_obj.id,
                        season_number=season['season_number'],
                        episode_count=season['episode_count'],
                    ))
            db_session.commit()
        if show_obj not in list_obj.shows:
            list_obj.shows.append(show_obj)
            db_session.commit()
        lists_cache_invalidate(current_user.id)
        return {'message': 'Show added to list', 'list': list_obj.to_dict(include_movies=True, include_shows=True)}
    else:
        existing = db_session.query(MovieModel).filter_by(user_id=current_user.id, tmdb_id=tmdb_id).first()
        movie_obj = existing or MovieModel(title=title, poster_url=poster_url, tmdb_id=tmdb_id, user_id=current_user.id)
        if not existing:
            db_session.add(movie_obj)
            db_session.commit()
        if movie_obj not in list_obj.movies:
            list_obj.movies.append(movie_obj)
            db_session.commit()
        lists_cache_invalidate(current_user.id)
        return {'message': 'Movie added to list', 'list': list_obj.to_dict(include_movies=True, include_shows=True)}


@router.delete('/{list_id}/remove/{item_id}')
async def remove_from_list(
    list_id: int,
    item_id: int,
    media_type: str | None = None,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    list_obj = db_session.get(movielist, list_id)
    if not list_obj:
        raise HTTPException(status_code=404)
    if not list_obj.can_edit(current_user):
        raise HTTPException(status_code=403, detail='No permission to edit this list')

    # movies and shows have their own ids, so the same number can be both
    movie_obj = db_session.get(MovieModel, item_id) if media_type != 'tv' else None
    if movie_obj and movie_obj in list_obj.movies:
        list_obj.movies.remove(movie_obj)
        db_session.commit()
        if not movie_obj.lists:
            db_session.delete(movie_obj)
            db_session.commit()
        lists_cache_invalidate(current_user.id)
        return {'message': 'Movie removed from list'}

    show_obj = db_session.get(ShowModel, item_id) if media_type != 'movie' else None
    if show_obj and show_obj in list_obj.shows:
        list_obj.shows.remove(show_obj)
        db_session.commit()
        lists_cache_invalidate(current_user.id)
        return {'message': 'Show removed from list'}

    raise HTTPException(status_code=404, detail='Item not found in list')
