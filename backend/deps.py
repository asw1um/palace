import os
from datetime import datetime, timedelta
from typing import Generator

from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from models import user as User

load_dotenv()

SECRET_KEY = os.getenv('JWT_SECRET_KEY')
if not SECRET_KEY:
    raise RuntimeError('JWT_SECRET_KEY is not set, add it to .env')
ALGORITHM = 'HS256'
TOKEN_DAYS = int(os.getenv('JWT_EXPIRE_DAYS', '30'))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl='/api/auth/login')


def get_db() -> Generator[Session, None, None]:
    import models.database as _db_module
    db = _db_module.SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def create_access_token(user_id: int, session_token: str) -> str:
    payload = {
        'sub': str(user_id),
        'st': session_token,
        'exp': datetime.utcnow() + timedelta(days=TOKEN_DAYS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail='Invalid or expired token',
        headers={'WWW-Authenticate': 'Bearer'},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload['sub'])
        session_token: str = payload.get('st')
        # old tokens had no expiry, make those log in again
        if not session_token or 'exp' not in payload:
            raise credentials_error
    except (JWTError, ValueError, KeyError):
        raise credentials_error

    current_user = db.get(User, user_id)
    if not current_user:
        raise credentials_error
    if current_user.session_token != session_token:
        raise credentials_error

    return current_user
