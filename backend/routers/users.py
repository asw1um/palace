import os
import time

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.orm import Session
from werkzeug.utils import secure_filename

from deps import get_current_user, get_db
from models import db, user as User, movielist
from activity import log_event

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'instance', 'uploads')
PROFILE_FOLDER = os.path.join(UPLOAD_FOLDER, 'profiles')
BANNER_FOLDER = os.path.join(UPLOAD_FOLDER, 'banners')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

os.makedirs(PROFILE_FOLDER, exist_ok=True)
os.makedirs(BANNER_FOLDER, exist_ok=True)


def _abs_url(path: str | None, request: Request) -> str | None:
    if not path:
        return None
    if path.startswith('http'):
        return path
    return f"{str(request.base_url).rstrip('/')}{path}"


def _allowed_file(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


class profile_update(BaseModel):
    nickname: str = ''
    bio: str = ''


@router.put('/profile')
async def update_profile(
    body: profile_update,
    request: Request,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    nickname = body.nickname.strip()
    bio = body.bio.strip()

    if len(nickname) > 16:
        raise HTTPException(status_code=400, detail='Nickname must be 16 characters or fewer')
    if len(bio) > 500:
        raise HTTPException(status_code=400, detail='Bio must be 500 characters or fewer')

    current_user.nickname = nickname or None
    current_user.bio = bio
    db_session.commit()

    data = current_user.to_dict()
    data['profile_picture'] = _abs_url(data.get('profile_picture'), request)
    data['banner'] = _abs_url(data.get('banner'), request)
    return data


@router.post('/upload-picture')
async def upload_profile_picture(
    request: Request,
    file: UploadFile = File(...),
    zoom: float = Form(1.0),
    pos_x: int = Form(50),
    pos_y: int = Form(50),
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    if not file.filename or not _allowed_file(file.filename):
        raise HTTPException(status_code=400, detail='Invalid file type')

    ext = secure_filename(file.filename).rsplit('.', 1)[1].lower()
    filename = f"{current_user.id}_{int(time.time())}.{ext}"
    filepath = os.path.join(PROFILE_FOLDER, filename)

    content = await file.read()
    with open(filepath, 'wb') as f:
        f.write(content)

    if current_user.profile_picture:
        old_path = os.path.join(UPLOAD_FOLDER, current_user.profile_picture.replace('/uploads/', ''))
        if os.path.exists(old_path):
            os.remove(old_path)

    current_user.profile_picture = f"/uploads/profiles/{filename}"
    current_user.pfp_zoom = zoom
    current_user.pfp_pos_x = pos_x
    current_user.pfp_pos_y = pos_y
    db_session.commit()

    log_event(
        event_type='user_changed_pfp',
        user_id=current_user.id,
        description=f"{current_user.display_name} changed their profile picture",
        session=db_session,
    )
    return {'message': 'Profile picture updated', 'url': _abs_url(current_user.profile_picture, request)}


@router.post('/upload-banner')
async def upload_banner(
    request: Request,
    file: UploadFile = File(...),
    zoom: float = Form(1.0),
    pos_x: int = Form(50),
    pos_y: int = Form(50),
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    if not file.filename or not _allowed_file(file.filename):
        raise HTTPException(status_code=400, detail='Invalid file type')

    ext = secure_filename(file.filename).rsplit('.', 1)[1].lower()
    filename = f"{current_user.id}_{int(time.time())}.{ext}"
    filepath = os.path.join(BANNER_FOLDER, filename)

    content = await file.read()
    with open(filepath, 'wb') as f:
        f.write(content)

    if current_user.banner:
        old_path = os.path.join(UPLOAD_FOLDER, current_user.banner.replace('/uploads/', ''))
        if os.path.exists(old_path):
            os.remove(old_path)

    current_user.banner = f"/uploads/banners/{filename}"
    current_user.banner_zoom = zoom
    current_user.banner_pos_x = pos_x
    current_user.banner_pos_y = pos_y
    db_session.commit()

    log_event(
        event_type='user_changed_banner',
        user_id=current_user.id,
        description=f"{current_user.display_name} changed their banner",
        session=db_session,
    )
    return {'message': 'Banner updated', 'url': _abs_url(current_user.banner, request)}


@router.get('/users')
async def get_users(
    request: Request,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    users = db_session.query(User).all()
    return {
        'users': [
            {
                'id': u.id,
                'username': u.username,
                'nickname': u.nickname,
                'bio': u.bio or '',
                'profile_picture': _abs_url(u.profile_picture, request),
                'banner': _abs_url(u.banner, request),
                'created_at': u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ]
    }


@router.get('/users/{username}')
async def get_user_profile(
    username: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    target_user = db_session.query(User).filter_by(username=username).first()
    if not target_user:
        raise HTTPException(status_code=404, detail='User not found')

    user_lists = db_session.query(movielist).filter_by(user_id=target_user.id).all()

    return {
        'user': {
            'id': target_user.id,
            'username': target_user.username,
            'nickname': target_user.nickname,
            'bio': target_user.bio or '',
            'profile_picture': _abs_url(target_user.profile_picture, request),
            'banner': _abs_url(target_user.banner, request),
            'banner_zoom': target_user.banner_zoom,
            'banner_pos_x': target_user.banner_pos_x,
            'banner_pos_y': target_user.banner_pos_y,
            'pfp_zoom': target_user.pfp_zoom,
            'pfp_pos_x': target_user.pfp_pos_x,
            'pfp_pos_y': target_user.pfp_pos_y,
            'created_at': target_user.created_at.isoformat() if target_user.created_at else None,
        },
        'lists': [lst.to_dict(include_movies=True, include_shows=True) for lst in user_lists],
        'clubs': [
            {
                'id': c.id,
                'name': c.name,
                'description': c.description,
                'member_count': len(c.members),
            }
            for c in target_user.clubs
        ],
    }
