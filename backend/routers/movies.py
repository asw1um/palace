from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List

from deps import get_current_user, get_db
from models import user as User, movie as Movie, movielist
from activity import log_event

router = APIRouter()


class add_movie_request(BaseModel):
    title: str
    poster: str | None = None
    tmdb_id: int
    list_ids: List[int] = []


class remove_movie_request(BaseModel):
    list_id: int


@router.post('/add')
async def add_movie(
    body: add_movie_request,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    if not body.list_ids:
        raise HTTPException(status_code=400, detail='Select at least one list')

    existing = db_session.query(Movie).filter_by(user_id=current_user.id, tmdb_id=body.tmdb_id).first()
    new_movie = existing or Movie(title=body.title, poster_url=body.poster, tmdb_id=body.tmdb_id, user_id=current_user.id)
    if not existing:
        db_session.add(new_movie)
        db_session.commit()

    added_to = []
    for list_id in body.list_ids:
        list_obj = db_session.get(movielist, list_id)
        if list_obj and list_obj.can_edit(current_user) and new_movie not in list_obj.movies:
            list_obj.movies.append(new_movie)
            added_to.append(list_obj)

    if added_to:
        db_session.commit()
        for list_obj in added_to:
            if list_obj.is_club_list():
                log_event(
                    event_type='user_in_club_added_movie',
                    user_id=current_user.id,
                    club_id=list_obj.club_id,
                    list_id=list_obj.id,
                    movie_id=new_movie.id,
                    description=f"Added '{body.title}' to club list '{list_obj.name}'",
                    extra_data={'movie_title': body.title, 'list_name': list_obj.name, 'club_name': list_obj.club.name},
                    session=db_session,
                )
            else:
                log_event(
                    event_type='user_added_movie',
                    user_id=current_user.id,
                    list_id=list_obj.id,
                    movie_id=new_movie.id,
                    description=f"Added '{body.title}' to list '{list_obj.name}'",
                    extra_data={'movie_title': body.title, 'list_name': list_obj.name},
                    session=db_session,
                )
        return {'message': f'Added {body.title} to {", ".join(l.name for l in added_to)}'}
    return {'message': f'{body.title} is already in those lists'}


@router.post('/remove/{movie_id}')
async def remove_movie(
    movie_id: int,
    body: remove_movie_request,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    list_obj = db_session.get(movielist, body.list_id)
    if not list_obj:
        raise HTTPException(status_code=404)
    if not list_obj.can_edit(current_user):
        raise HTTPException(status_code=403, detail='No permission to edit this list')

    movie_obj = db_session.get(Movie, movie_id)
    if not movie_obj:
        raise HTTPException(status_code=404)

    if movie_obj not in list_obj.movies:
        raise HTTPException(status_code=404, detail='Movie not found in list')

    list_obj.movies.remove(movie_obj)
    db_session.commit()

    if list_obj.is_club_list():
        log_event(
            event_type='user_in_club_removed_movie',
            user_id=current_user.id,
            club_id=list_obj.club_id,
            list_id=list_obj.id,
            movie_id=movie_obj.id,
            description=f"Removed '{movie_obj.title}' from club list '{list_obj.name}'",
            extra_data={'movie_title': movie_obj.title, 'list_name': list_obj.name, 'club_name': list_obj.club.name},
            session=db_session,
        )
    else:
        log_event(
            event_type='user_removed_movie',
            user_id=current_user.id,
            list_id=list_obj.id,
            movie_id=movie_obj.id,
            description=f"Removed '{movie_obj.title}' from list '{list_obj.name}'",
            extra_data={'movie_title': movie_obj.title, 'list_name': list_obj.name},
            session=db_session,
        )

    if not movie_obj.lists:
        db_session.delete(movie_obj)
        db_session.commit()

    return {'message': f'Removed {movie_obj.title} from {list_obj.name}'}


@router.get('/my-movies')
async def get_my_movies(
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    user_lists = db_session.query(movielist).filter_by(user_id=current_user.id).all()
    return {'lists': [lst.to_dict(include_movies=True, include_shows=True) for lst in user_lists]}
