from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Any

from deps import get_current_user, get_db
from models import user as User, UserSettings, movielist

router = APIRouter()


def _is_id(value):
    return isinstance(value, int) and not isinstance(value, bool) and value > 0


def _id_list(value):
    if not isinstance(value, list) or len(value) > 50 or not all(_is_id(v) for v in value):
        raise HTTPException(status_code=400, detail='Expected a list of ids')
    return value


class settings_update(BaseModel):
    displayed_list: Any = None
    pinned_lists: Any = None
    pinned_clubs: Any = None
    theme: Any = None


@router.get('')
@router.get('/')
async def get_settings(
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    if not current_user.settings:
        us = UserSettings(user_id=current_user.id)
        db_session.add(us)
        db_session.commit()
    return current_user.settings.to_dict()


@router.put('')
@router.put('/')
async def save_settings(
    body: settings_update,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    if not current_user.settings:
        us = UserSettings(user_id=current_user.id)
        db_session.add(us)
        db_session.commit()

    # null clears the dashboard list, leaving it out keeps it
    if 'displayed_list' in body.model_fields_set:
        list_id = body.displayed_list
        if list_id is not None:
            if not _is_id(list_id):
                raise HTTPException(status_code=400, detail='Invalid list')
            list_obj = db_session.get(movielist, list_id)
            mine = list_obj and (
                list_obj.user_id == current_user.id
                or (list_obj.is_club_list() and list_obj.club.is_member(current_user))
            )
            if not mine:
                raise HTTPException(status_code=400, detail='Invalid list')
        current_user.settings.displayed_list = list_id
    if body.pinned_lists is not None:
        current_user.settings.pinned_lists = _id_list(body.pinned_lists)
    if body.pinned_clubs is not None:
        current_user.settings.pinned_clubs = _id_list(body.pinned_clubs)
    if body.theme is not None:
        if not isinstance(body.theme, str) or len(body.theme) > 20:
            raise HTTPException(status_code=400, detail='Invalid theme')
        current_user.settings.theme = body.theme

    db_session.commit()
    return current_user.settings.to_dict()
