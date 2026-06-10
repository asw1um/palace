import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from werkzeug.security import check_password_hash, generate_password_hash

from deps import create_access_token, get_current_user, get_db
from models import db, user as User, movielist
from activity import log_event

router = APIRouter()


class signup_request(BaseModel):
    username: str
    password: str
    nickname: str | None = None


class login_request(BaseModel):
    username: str
    password: str


def _abs_url(path: str | None, request: Request) -> str | None:
    if not path:
        return None
    if path.startswith('http'):
        return path
    base = str(request.base_url).rstrip('/')
    return f"{base}{path}"


@router.post('/register', status_code=201)
@router.post('/signup', status_code=201)
async def signup(body: signup_request, request: Request, db_session: Session = Depends(get_db)):
    username = body.username.strip()
    password = body.password
    nickname = body.nickname.strip() if body.nickname else None

    if not username or len(username) < 1 or len(username) > 32:
        raise HTTPException(status_code=400, detail='Username must be 1-32 characters')
    if not password or len(password) < 6:
        raise HTTPException(status_code=400, detail='Password must be at least 6 characters')
    if db_session.query(User).filter_by(username=username).first():
        raise HTTPException(status_code=409, detail='Username already exists')

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

    log_user = db_session.query(User).filter_by(username=username).first()
    if not log_user or not check_password_hash(log_user.password_hash, password):
        raise HTTPException(status_code=401, detail='Invalid username or password')

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
