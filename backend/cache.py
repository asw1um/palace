import time
from threading import RLock
from datetime import datetime, timedelta
from models import db


class tmdb_cache(db.Model):
    __tablename__ = 'tmdb_cache'

    id         = db.Column(db.Integer, primary_key=True)
    cache_key  = db.Column(db.String(500), nullable=False, unique=True, index=True)
    data       = db.Column(db.JSON, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False, index=True)

    @classmethod
    def get(cls, key):
        import models.database as _db_module
        sess = _db_module.SessionLocal()
        try:
            entry = sess.query(cls).filter_by(cache_key=key).first()
            if not entry:
                return None
            if datetime.utcnow() > entry.expires_at:
                sess.delete(entry)
                sess.commit()
                return None
            return entry.data
        finally:
            sess.close()

    @classmethod
    def set(cls, key, data, ttl_hours=24):
        import models.database as _db_module
        sess = _db_module.SessionLocal()
        try:
            expires = datetime.utcnow() + timedelta(hours=ttl_hours)
            entry = sess.query(cls).filter_by(cache_key=key).first()
            if entry:
                entry.data = data
                entry.expires_at = expires
            else:
                sess.add(cls(cache_key=key, data=data, expires_at=expires))
            sess.commit()
        finally:
            sess.close()

    @classmethod
    def flush_expired(cls):
        import models.database as _db_module
        sess = _db_module.SessionLocal()
        try:
            sess.query(cls).filter(cls.expires_at < datetime.utcnow()).delete()
            sess.commit()
        finally:
            sess.close()


cache_get = tmdb_cache.get
cache_set = tmdb_cache.set
cache_flush_expired = tmdb_cache.flush_expired


def cache_flush():
    import models.database as _db_module
    sess = _db_module.SessionLocal()
    try:
        sess.query(tmdb_cache).delete()
        sess.commit()
    finally:
        sess.close()


# per user cache

_lists = {}
_lists_lock = RLock()
_LISTS_TTL = 30


def lists_cache_get(user_id):
    with _lists_lock:
        entry = _lists.get(user_id)
        if entry is None:
            return None
        data, expires = entry
        if time.monotonic() > expires:
            del _lists[user_id]
            return None
        return data


def lists_cache_set(user_id, data):
    with _lists_lock:
        _lists[user_id] = (data, time.monotonic() + _LISTS_TTL)


def lists_cache_invalidate(user_id):
    with _lists_lock:
        _lists.pop(user_id, None)