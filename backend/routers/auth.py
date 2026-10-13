import os
import re
import time
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from werkzeug.security import check_password_hash, generate_password_hash

from deps import create_access_token, get_current_user, get_db
from models import db, user as User, movielist
from activity import log_event

router = APIRouter()

USERNAME_RE = re.compile(r'^[A-Za-z0-9_.-]{1,32}$')

# failed logins per ip + username
_fails = {}
FAIL_LIMIT = 10
FAIL_WINDOW = 15 * 60


def _recent_fails(key):
    now = time.time()
    hits = [t for t in _fails.get(key, []) if now - t < FAIL_WINDOW]
    if hits:
        _fails[key] = hits
    else:
        _fails.pop(key, None)
    return hits


# new accounts per ip per hour
SIGNUP_LIMIT = int(os.getenv('SIGNUP_LIMIT_PER_HOUR', '10'))
_signups = {}


class signup_request(BaseModel):
    username: str
    password: str
    nickname: str | None = None


class login_request(BaseModel):
    username: str
    password: str


def _abs_url(path: str | None, request: Request) -> str | None:
    # keep it relative, the frontend proxies /uploads
    return path or None


@router.post('/register', status_code=201)
@router.post('/signup', status_code=201)
async def signup(body: signup_request, request: Request, db_session: Session = Depends(get_db)):
    username = body.username.strip()
    password = body.password
    nickname = body.nickname.strip() if body.nickname else None

    if not username or len(username) < 1 or len(username) > 32:
        raise HTTPException(status_code=400, detail='Username must be 1-32 characters')
    if not USERNAME_RE.match(username):
        raise HTTPException(status_code=400, detail='Username can only use letters, numbers, dots, dashes and underscores')
    if not password or len(password) < 6:
        raise HTTPException(status_code=400, detail='Password must be at least 6 characters')
    if len(password) > 128:
        raise HTTPException(status_code=400, detail='Password must be 128 characters or fewer')
    if nickname and len(nickname) > 16:
        raise HTTPException(status_code=400, detail='Nickname must be 16 characters or fewer')
    if db_session.query(User).filter(func.lower(User.username) == username.lower()).first():
        raise HTTPException(status_code=409, detail='Username already exists')

    ip = request.client.host if request.client else ''
    now = time.time()
    recent = [t for t in _signups.get(ip, []) if now - t < 3600]
    if len(recent) >= SIGNUP_LIMIT:
        raise HTTPException(status_code=429, detail='Too many accounts created from here, try again later')
    if len(_signups) > 10000:
        _signups.clear()
    _signups[ip] = recent + [now]

    new_user = User(
        username=username,
        password_hash=generate_password_hash(password),
        nickname=nickname,
    )
    db_session.add(new_user)
    db_session.commit()

    db_session.add(movielist(name='want to watch', user_id=new_user.id))
    db_session.add(movielist(name='watched', user_id=new_user.id))
    db_session.add(movielist(name='currently watching', user_id=new_user.id))
    db_session.commit()

    log_event(event_type='new_user', user_id=new_user.id,
              description=f"{new_user.display_name} joined the forum",
              session=db_session)

    token = create_access_token(new_user.id, new_user.session_token)
    user_data = new_user.to_dict()
    user_data['profile_picture'] = _abs_url(user_data.get('profile_picture'), request)
    user_data['banner'] = _abs_url(user_data.get('banner'), request)

    return {'message': 'Account created successfully', 'user': user_data, 'access_token': token}


@router.post('/login')
async def login(body: login_request, request: Request, db_session: Session = Depends(get_db)):
    username = body.username.strip()
    password = body.password

    if not username:
        raise HTTPException(status_code=400, detail='Username is required')
    if not password:
        raise HTTPException(status_code=400, detail='Password is required')

    ip = request.client.host if request.client else ''
    key = f'{ip}:{username.lower()}'
    if len(_recent_fails(key)) >= FAIL_LIMIT:
        raise HTTPException(status_code=429, detail='Too many failed logins, try again later')

    log_user = db_session.query(User).filter_by(username=username).first()
    if not log_user or len(password) > 128 or not check_password_hash(log_user.password_hash, password):
        if len(_fails) > 10000:
            _fails.clear()
        _fails.setdefault(key, []).append(time.time())
        raise HTTPException(status_code=401, detail='Invalid username or password')
    _fails.pop(key, None)

    token = create_access_token(log_user.id, log_user.session_token)
    user_data = log_user.to_dict()
    user_data['profile_picture'] = _abs_url(user_data.get('profile_picture'), request)
    user_data['banner'] = _abs_url(user_data.get('banner'), request)

    return {'message': 'Login successful', 'user': user_data, 'access_token': token}


@router.get('/me')
async def get_me(request: Request, current_user: User = Depends(get_current_user)):
    data = current_user.to_dict()
    data['profile_picture'] = _abs_url(data.get('profile_picture'), request)
    data['banner'] = _abs_url(data.get('banner'), request)
    return data


@router.post('/logout')
async def logout(
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    current_user.session_token = str(uuid.uuid4())
    db_session.commit()
    return {'message': 'Logout successful'}
