import os
import time
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.orm import Session
from werkzeug.security import check_password_hash, generate_password_hash

from deps import create_access_token, get_current_user, get_db
from models import db, user as User, movielist
from models import (
    movie as MovieModel, show as ShowModel, club as Club, club_name_history, activity_log,
    Review, ReviewReaction, ReviewComment, ShowProgress, MovieProgress, EpisodePosition,
    CustomMedia, UserSettings, Notification, ListShare,
)
from activity import log_event
from utils import read_image

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'instance', 'uploads')
PROFILE_FOLDER = os.path.join(UPLOAD_FOLDER, 'profiles')
BANNER_FOLDER = os.path.join(UPLOAD_FOLDER, 'banners')

os.makedirs(PROFILE_FOLDER, exist_ok=True)
os.makedirs(BANNER_FOLDER, exist_ok=True)


def _abs_url(path: str | None, request: Request) -> str | None:
    # keep it relative, the frontend proxies /uploads
    return path or None


class profile_update(BaseModel):
    nickname: str = ''
    bio: str = ''


class password_change(BaseModel):
    current_password: str
    new_password: str


class delete_account_request(BaseModel):
    password: str


def _remove_upload(path):
    if not path:
        return
    full = os.path.join(UPLOAD_FOLDER, path.replace('/uploads/', ''))
    if os.path.isfile(full):
        os.remove(full)


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
    content, ext = await read_image(file)
    filename = f"{current_user.id}_{int(time.time())}.{ext}"
    filepath = os.path.join(PROFILE_FOLDER, filename)

    with open(filepath, 'wb') as f:
        f.write(content)

    if current_user.profile_picture:
        old_path = os.path.join(UPLOAD_FOLDER, current_user.profile_picture.replace('/uploads/', ''))
        if old_path != filepath and os.path.exists(old_path):
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
    content, ext = await read_image(file)
    filename = f"{current_user.id}_{int(time.time())}.{ext}"
    filepath = os.path.join(BANNER_FOLDER, filename)

    with open(filepath, 'wb') as f:
        f.write(content)

    if current_user.banner:
        old_path = os.path.join(UPLOAD_FOLDER, current_user.banner.replace('/uploads/', ''))
        if old_path != filepath and os.path.exists(old_path):
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


@router.post('/change-password')
async def change_password(
    body: password_change,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    if len(body.current_password) > 128 or not check_password_hash(current_user.password_hash, body.current_password):
        raise HTTPException(status_code=400, detail='Current password is wrong')
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail='Password must be at least 6 characters')
    if len(body.new_password) > 128:
        raise HTTPException(status_code=400, detail='Password must be 128 characters or fewer')

    current_user.password_hash = generate_password_hash(body.new_password)
    # new session token signs every other device out
    current_user.session_token = str(uuid.uuid4())
    db_session.commit()
    token = create_access_token(current_user.id, current_user.session_token)
    return {'message': 'Password changed', 'access_token': token}


@router.get('/export')
async def export_data(
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    uid = current_user.id
    lists = db_session.query(movielist).filter_by(user_id=uid).all()
    reviews = db_session.query(Review).filter_by(user_id=uid).all()
    episodes = db_session.query(ShowProgress).filter_by(user_id=uid, watched=True).all()
    movies = db_session.query(MovieProgress).filter_by(user_id=uid).all()
    positions = db_session.query(EpisodePosition).filter_by(user_id=uid).all()
    custom = db_session.query(CustomMedia).filter_by(user_id=uid).all()

    profile = current_user.to_dict()
    return {
        'exported_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'profile': {k: profile.get(k) for k in ('username', 'nickname', 'bio', 'created_at')},
        'lists': [
            {
                'name': lst.name,
                'movies': [{'tmdb_id': m.tmdb_id, 'title': m.title} for m in lst.movies],
                'shows': [{'tmdb_id': s.tmdb_id, 'title': s.title} for s in lst.shows],
            }
            for lst in lists
        ],
        'reviews': [
            {
                'tmdb_id': r.tmdb_id, 'media_type': r.media_type, 'title': r.title, 'rating': r.rating,
                'content': r.content, 'is_spoiler': r.is_spoiler,
                'created_at': r.created_at.isoformat() if r.created_at else None,
            }
            for r in reviews
        ],
        'watched_episodes': [
            {
                'show_id': e.show_id, 'season_number': e.season_number, 'episode_number': e.episode_number,
                'marked_at': e.created_at.isoformat() if e.created_at else None,
            }
            for e in episodes
        ],
        'movie_progress': [
            {'movie_id': m.movie_id, 'watched_minutes': m.watched_minutes, 'total_minutes': m.total_minutes}
            for m in movies
        ],
        'positions': [p.to_dict() for p in positions],
        'custom_media': [c.to_dict() for c in custom],
        'clubs': [{'name': c.name, 'role': 'admin' if c.admin_id == uid else 'member'} for c in current_user.clubs],
    }


@router.post('/delete-account')
async def delete_account(
    body: delete_account_request,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    if len(body.password) > 128 or not check_password_hash(current_user.password_hash, body.password):
        raise HTTPException(status_code=400, detail='Password is wrong')
    uid = current_user.id

    # clubs they run go to a mod, then any member, and are removed if nobody is left
    for club_obj in db_session.query(Club).filter_by(admin_id=uid).all():
        others = [m for m in club_obj.members if m.id != uid]
        if not others:
            for lst in list(club_obj.lists):
                db_session.query(ListShare).filter_by(list_id=lst.id).delete()
                lst.movies = []
                lst.shows = []
            db_session.query(club_name_history).filter_by(club_id=club_obj.id).delete()
            _remove_upload(club_obj.image_url)
            club_obj.members = []
            db_session.delete(club_obj)
            continue
        mods = [m for m in others if m.id in (club_obj.mod_ids or [])]
        club_obj.admin_id = (mods or others)[0].id
    db_session.flush()

    for club_obj in list(current_user.clubs):
        club_obj.remove_member(current_user)
        club_obj.mod_ids = [i for i in (club_obj.mod_ids or []) if i not in (uid, club_obj.admin_id)]
        club_obj.helper_ids = [i for i in (club_obj.helper_ids or []) if i not in (uid, club_obj.admin_id)]

    for lst in db_session.query(movielist).filter_by(user_id=uid).all():
        db_session.query(ListShare).filter_by(list_id=lst.id).delete()
        lst.movies = []
        lst.shows = []
        db_session.delete(lst)
    db_session.flush()

    # anything they put on a club list stays there under that clubs admin
    for item in db_session.query(MovieModel).filter_by(user_id=uid).all():
        club_lists = [l for l in item.lists if l.club_id]
        if club_lists:
            item.user_id = club_lists[0].club.admin_id
        else:
            db_session.delete(item)
    for item in db_session.query(ShowModel).filter_by(user_id=uid).all():
        club_lists = [l for l in item.show_lists if l.club_id]
        if club_lists:
            item.user_id = club_lists[0].club.admin_id
        else:
            db_session.delete(item)
    db_session.flush()

    review_ids = [r.id for r in db_session.query(Review).filter_by(user_id=uid).all()]
    if review_ids:
        db_session.query(ReviewComment).filter(ReviewComment.review_id.in_(review_ids)).delete(synchronize_session=False)
        db_session.query(ReviewReaction).filter(ReviewReaction.review_id.in_(review_ids)).delete(synchronize_session=False)
    for model in (ReviewComment, ReviewReaction, Review, ShowProgress, MovieProgress, EpisodePosition,
                  CustomMedia, UserSettings, Notification):
        db_session.query(model).filter_by(user_id=uid).delete(synchronize_session=False)
    db_session.query(activity_log).filter(
        (activity_log.user_id == uid) | (activity_log.target_user_id == uid)
    ).delete(synchronize_session=False)
    db_session.query(club_name_history).filter_by(changed_by_user_id=uid).delete(synchronize_session=False)

    _remove_upload(current_user.profile_picture)
    _remove_upload(current_user.banner)
    db_session.delete(current_user)
    db_session.commit()
    return {'message': 'Account deleted'}
