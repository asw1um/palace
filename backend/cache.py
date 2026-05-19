from datetime import datetime, timedelta
from dbstruct import db


class tmdb_cache(db.Model):
    __tablename__ = 'tmdb_cache'

    id = db.Column(db.Integer, primary_key=True)
    cache_key = db.Column(db.String(500), nullable=False, unique=True, index=True)
    data = db.Column(db.JSON, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)

    @classmethod
    def get(cls, key):
        entry = cls.query.filter_by(cache_key=key).first()
        if not entry:
            return None
        if datetime.utcnow() > entry.expires_at:
            db.session.delete(entry)
            db.session.commit()
            return None
        return entry.data

    @classmethod
    def set(cls, key, data, ttl_hours=24):
        entry = cls.query.filter_by(cache_key=key).first()
        expires = datetime.utcnow() + timedelta(hours=ttl_hours)
        if entry:
            entry.data = data
            entry.expires_at = expires
            entry.created_at = datetime.utcnow()
        else:
            entry = cls(cache_key=key, data=data, expires_at=expires)
            db.session.add(entry)
        db.session.commit()
        return entry

    @classmethod
    def flush(cls):
        cls.query.delete()
        db.session.commit()

    @classmethod
    def flush_expired(cls):
        cls.query.filter(cls.expires_at < datetime.utcnow()).delete()
        db.session.commit()


def cache_get(key):
    return tmdb_cache.get(key)


def cache_set(key, data, ttl_hours=24):
    return tmdb_cache.set(key, data, ttl_hours)


def cache_flush():
    return tmdb_cache.flush()


def cache_flush_expired():
    return tmdb_cache.flush_expired()
