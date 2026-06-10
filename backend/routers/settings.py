from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Any

from deps import get_current_user, get_db
from models import user as User, UserSettings

router = APIRouter()


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

    if body.displayed_list is not None:
        current_user.settings.displayed_list = body.displayed_list
    if body.pinned_lists is not None:
        current_user.settings.pinned_lists = body.pinned_lists
    if body.pinned_clubs is not None:
        current_user.settings.pinned_clubs = body.pinned_clubs
    if body.theme is not None:
        current_user.settings.theme = body.theme

    db_session.commit()
    return current_user.settings.to_dict()
