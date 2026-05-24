import uuid
from datetime import datetime
from .database import db, club_members


class user(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    discord_id = db.Column(db.String(64), unique=True, nullable=True)
    username = db.Column(db.String(32), nullable=False, unique=True)
    nickname = db.Column(db.String(16), nullable=True)
    password_hash = db.Column(db.String(256), nullable=False)
    session_token = db.Column(db.String(36), nullable=False, default=lambda: str(uuid.uuid4()))
    bio = db.Column(db.String(500), nullable=True, default='')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    profile_picture = db.Column(db.String(300), nullable=True)
    pfp_zoom = db.Column(db.Float, nullable=True, default=1.0)
    pfp_pos_x = db.Column(db.Integer, nullable=True, default=50)
    pfp_pos_y = db.Column(db.Integer, nullable=True, default=50)
    banner = db.Column(db.String(300), nullable=True)
    banner_zoom = db.Column(db.Float, nullable=True, default=1.0)
    banner_pos_x = db.Column(db.Integer, nullable=True, default=50)
    banner_pos_y = db.Column(db.Integer, nullable=True, default=50)
    pinned_list_ids = db.Column(db.JSON, default=list)
    pinned_club_ids = db.Column(db.JSON, default=list)

    movies = db.relationship('movie', backref='author', lazy=True)
    clubs = db.relationship('club', secondary=club_members, backref='members', lazy=True)

    @property
    def display_name(self):
        return self.nickname or self.username

    def __repr__(self):
        return f"User('{self.username}')"

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'nickname': self.nickname,
            'bio': self.bio or '',
            'discord_id': self.discord_id,
            'profile_picture': self.profile_picture,
            'pfp_zoom': self.pfp_zoom,
            'pfp_pos_x': self.pfp_pos_x,
            'pfp_pos_y': self.pfp_pos_y,
            'banner': self.banner,
            'banner_zoom': self.banner_zoom,
            'banner_pos_x': self.banner_pos_x,
            'banner_pos_y': self.banner_pos_y,
            'pinned_list_ids': self.pinned_list_ids or [],
            'pinned_club_ids': self.pinned_club_ids or [],
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
