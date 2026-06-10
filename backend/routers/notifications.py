from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from deps import get_current_user, get_db
from models import Notification, ClubInviteNotification, ClubNewMemberNotification
from models import club as Club, user as User

router = APIRouter()


@router.get('/user')
async def get_user_notifications(
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    notifs = (
        db_session.query(Notification)
        .filter_by(user_id=current_user.id)
        .order_by(Notification.created_at.desc())
        .all()
    )
    return {'notifications': [n.to_dict() for n in notifs]}


@router.post('/user/{notification_id}/read')
async def mark_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    notif = db_session.query(Notification).filter_by(id=notification_id, user_id=current_user.id).first()
    if not notif:
        raise HTTPException(status_code=404)
    notif.is_read = True
    db_session.commit()
    return {'message': 'Marked as read'}


@router.post('/user/{notification_id}/unread')
async def mark_unread(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    notif = db_session.query(Notification).filter_by(id=notification_id, user_id=current_user.id).first()
    if not notif:
        raise HTTPException(status_code=404)
    notif.is_read = False
    db_session.commit()
    return {'message': 'Marked as unread'}


@router.delete('/user/{notification_id}')
async def delete_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    notif = db_session.query(Notification).filter_by(id=notification_id, user_id=current_user.id).first()
    if not notif:
        raise HTTPException(status_code=404)
    db_session.delete(notif)
    db_session.commit()
    return {'message': 'Notification deleted'}


@router.post('/user/read-all')
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    db_session.query(Notification).filter_by(user_id=current_user.id, is_read=False).update({'is_read': True})
    db_session.commit()
    return {'message': 'All notifications marked as read'}


@router.post('/invite/{notification_id}/accept')
async def accept_invite(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    notif = db_session.query(ClubInviteNotification).filter_by(id=notification_id, user_id=current_user.id).first()
    if not notif:
        raise HTTPException(status_code=404)

    club_obj = db_session.get(Club, notif.data['club_id'])
    if not club_obj:
        raise HTTPException(status_code=400, detail='Club no longer exists')

    club_obj.add_member(current_user)
    db_session.delete(notif)
    db_session.commit()

    for member in club_obj.members:
        if member.id == current_user.id:
            continue
        db_session.add(ClubNewMemberNotification(
            user_id=member.id,
            title='New Member',
            message=f'{current_user.display_name} joined the club.',
            data={
                'club_id': club_obj.id,
                'club_name': club_obj.name,
                'new_member_user_id': current_user.id,
                'new_member_name': current_user.display_name,
            },
        ))
    db_session.commit()

    return {'message': f'Joined club: {club_obj.name}'}


@router.post('/invite/{notification_id}/decline')
async def decline_invite(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    notif = db_session.query(ClubInviteNotification).filter_by(id=notification_id, user_id=current_user.id).first()
    if not notif:
        raise HTTPException(status_code=404)
    db_session.delete(notif)
    db_session.commit()
    return {'message': 'Invite declined'}
