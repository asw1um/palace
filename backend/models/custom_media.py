from datetime import datetime
from .database import db


class CustomMedia(db.Model):
    __tablename__ = 'custom_media'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    tmdb_id = db.Column(db.Integer, nullable=False)
    media_type = db.Column(db.String(10), nullable=False)  # 'movie' or 'tv'
    runtime = db.Column(db.Integer, nullable=True)          # movies: total minutes
    seasons = db.Column(db.JSON, nullable=True)             # shows: [{season_number, episode_count}]
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint('user_id', 'tmdb_id', 'media_type', name='uq_user_custom_media'),)

    def to_dict(self):
        return {
            'tmdb_id': self.tmdb_id,
            'media_type': self.media_type,
            'runtime': self.runtime,
            'seasons': self.seasons,
        }
