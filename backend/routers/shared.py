from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from deps import get_db
from models import movielist, ListShare, user as User

router = APIRouter()


# no login needed, the token is the permission
@router.get('/{token}')
async def get_shared_list(token: str, db_session: Session = Depends(get_db)):
    share = db_session.query(ListShare).filter_by(token=token).first()
    list_obj = db_session.get(movielist, share.list_id) if share else None
    if not list_obj:
        raise HTTPException(status_code=404, detail='List not found')

    if list_obj.is_club_list():
        owner = list_obj.club.name
    else:
        owner_obj = db_session.get(User, list_obj.user_id)
        owner = owner_obj.display_name if owner_obj else ''

    return {
        'name': list_obj.name,
        'owner': owner,
        'is_club': list_obj.is_club_list(),
        'items': [
            {'tmdb_id': m.tmdb_id, 'media_type': 'movie', 'title': m.title, 'poster_url': m.poster_url}
            for m in list_obj.movies
        ] + [
            {'tmdb_id': s.tmdb_id, 'media_type': 'tv', 'title': s.title, 'poster_url': s.poster_url}
            for s in list_obj.shows
        ],
    }
