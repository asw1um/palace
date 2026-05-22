from datetime import datetime
from .database import db


class ShowProgress(db.Model):
    __tablename__ = 'show_progress'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    show_id = db.Column(db.Integer, nullable=False)
    season_number = db.Column(db.Integer, nullable=False)
    episode_number = db.Column(db.Integer, nullable=False)
    watched = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'show_id': self.show_id,
            'season_number': self.season_number,
            'episode_number': self.episode_number,
            'watched': self.watched,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class MovieProgress(db.Model):
    __tablename__ = 'movie_progress'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    movie_id = db.Column(db.Integer, nullable=False)
    watched_minutes = db.Column(db.Integer, default=0)
    total_minutes = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'movie_id': self.movie_id,
            'watched_minutes': self.watched_minutes,
            'total_minutes': self.total_minutes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
