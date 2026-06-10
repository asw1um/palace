from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from deps import get_current_user, get_db
from models import user as User, club as Club, movielist
from activity import log_event

router = APIRouter()


class create_club_list_request(BaseModel):
    name: str


class rename_club_list_request(BaseModel):
    name: str


@router.post('/{club_id}/lists', status_code=201)
async def create_club_list(
    club_id: int,
    body: create_club_list_request,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    club_obj = db_session.get(Club, club_id)
    if not club_obj:
        raise HTTPException(status_code=404)
    if not club_obj.can_manage_lists(current_user):
        raise HTTPException(status_code=403, detail='Must be a helper, mod, or admin to create lists')

    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail='List name cannot be empty')

    new_list = movielist(name=name, club_id=club_id)
    db_session.add(new_list)
    db_session.commit()

    log_event(
        event_type='user_created_club_list',
        user_id=current_user.id,
        club_id=club_id,
        list_id=new_list.id,
        description=f"Created list '{name}' in club {club_obj.name}",
        extra_data={'list_name': name, 'club_name': club_obj.name},
        session=db_session,
    )
    return {'message': f'Created list: {name}', 'list': new_list.to_dict()}


@router.delete('/{club_id}/lists/{list_id}')
async def delete_club_list(
    club_id: int,
    list_id: int,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    club_obj = db_session.get(Club, club_id)
    if not club_obj:
        raise HTTPException(status_code=404)
    list_obj = db_session.get(movielist, list_id)
    if not list_obj:
        raise HTTPException(status_code=404)
    if not club_obj.can_manage(current_user):
        raise HTTPException(status_code=403, detail='Must be a mod or admin to delete lists')
    if list_obj.club_id != club_id:
        raise HTTPException(status_code=403, detail='List not in this club')

    log_event(
        event_type='user_deleted_club_list',
        user_id=current_user.id,
        club_id=club_id,
        list_id=list_obj.id,
        description=f"Deleted list '{list_obj.name}' from club {club_obj.name}",
        extra_data={'list_name': list_obj.name, 'club_name': club_obj.name},
        session=db_session,
    )
    db_session.delete(list_obj)
    db_session.commit()
    return {'message': 'List deleted'}


@router.post('/{club_id}/lists/{list_id}/rename')
async def rename_club_list(
    club_id: int,
    list_id: int,
    body: rename_club_list_request,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    club_obj = db_session.get(Club, club_id)
    if not club_obj:
        raise HTTPException(status_code=404)
    list_obj = db_session.get(movielist, list_id)
    if not list_obj:
        raise HTTPException(status_code=404)
    if not club_obj.can_manage(current_user):
        raise HTTPException(status_code=403, detail='Must be a mod or admin to rename lists')
    if list_obj.club_id != club_id:
        raise HTTPException(status_code=403, detail='List not in this club')

    new_name = body.name.strip()
    if not new_name:
        raise HTTPException(status_code=400, detail='Name cannot be empty')

    old_name = list_obj.name
    list_obj.name = new_name
    db_session.commit()

    log_event(
        event_type='user_renamed_club_list',
        user_id=current_user.id,
        club_id=club_id,
        list_id=list_obj.id,
        description=f"Renamed list from '{old_name}' to '{new_name}' in club {club_obj.name}",
        extra_data={'old_name': old_name, 'new_name': new_name, 'club_name': club_obj.name},
        session=db_session,
    )
    return {'message': f'Renamed list to: {new_name}', 'list': list_obj.to_dict()}
