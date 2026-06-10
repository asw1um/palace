from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from deps import get_current_user, get_db
from models import activity_log, user as User, club as Club
from utils import time_ago

router = APIRouter()


def _log_to_dict(log_entry):
    data = log_entry.to_dict(include_actor=True)
    data['time_ago'] = time_ago(log_entry.created_at)
    return data


@router.get('')
@router.get('/')
async def get_all_activity(
    club_id: int | None = Query(default=None),
    event_type: str | None = Query(default=None),
    limit: int = Query(default=50),
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    q = db_session.query(activity_log)
    if club_id:
        q = q.filter_by(club_id=club_id)
    if event_type:
        q = q.filter_by(event_type=event_type)
    logs = q.order_by(activity_log.created_at.desc()).limit(limit).all()
    return {'activities': [_log_to_dict(log) for log in logs]}


@router.get('/user')
async def get_user_activity(
    limit: int = Query(default=50),
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    logs = db_session.query(activity_log).filter(
        (activity_log.user_id == current_user.id) | (activity_log.target_user_id == current_user.id)
    ).order_by(activity_log.created_at.desc()).limit(limit).all()
    return {'activities': [_log_to_dict(log) for log in logs]}


@router.get('/user/{target_id}')
async def get_user_activity_by_id(
    target_id: int,
    limit: int = Query(default=50),
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    logs = db_session.query(activity_log).filter(
        (activity_log.user_id == target_id) | (activity_log.target_user_id == target_id)
    ).order_by(activity_log.created_at.desc()).limit(limit).all()
    return {'activities': [_log_to_dict(log) for log in logs]}


@router.get('/club/{club_id}')
async def get_club_activity(
    club_id: int,
    limit: int = Query(default=50),
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    club_obj = db_session.get(Club, club_id)
    if not club_obj:
        raise HTTPException(status_code=404)
    if not club_obj.is_member(current_user):
        raise HTTPException(status_code=403, detail='Must be a club member to view activity')

    logs = db_session.query(activity_log).filter_by(club_id=club_id)\
        .order_by(activity_log.created_at.desc()).limit(limit).all()
    return {'activities': [_log_to_dict(log) for log in logs]}


@router.get('/global')
async def get_global_activity(
    limit: int = Query(default=50),
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    public_types = [
        'new_user', 'user_created_club', 'user_joined_club', 'user_left_club',
        'user_renamed_club', 'user_deleted_club', 'user_changed_pfp', 'user_changed_banner',
    ]
    logs = db_session.query(activity_log).filter(
        activity_log.event_type.in_(public_types)
    ).order_by(activity_log.created_at.desc()).limit(limit).all()
    return {'activities': [_log_to_dict(log) for log in logs]}
