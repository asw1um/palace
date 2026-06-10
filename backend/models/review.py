from datetime import datetime, timezone
from .database import db


class Review(db.Model):
    __tablename__ = 'reviews'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    tmdb_id = db.Column(db.Integer, nullable=False)
    media_type = db.Column(db.String(10), nullable=False)  # 'movie' or 'tv'
    title = db.Column(db.String(200))
    poster_url = db.Column(db.String(300))
    rating = db.Column(db.Float, nullable=True)
    content = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))
    is_spoiler = db.Column(db.Boolean, default = False, nullable=False)

    author = db.relationship('user', backref='reviews')

    def to_dict(self, include_author=False):
        data = {
            'id': self.id,
            'user_id': self.user_id,
            'tmdb_id': self.tmdb_id,
            'media_type': self.media_type,
            'title': self.title or '',
            'poster_url': self.poster_url or '',
            'rating': self.rating,
            'content': self.content or '',
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_author and self.author:
            data['author'] = {
                'id': self.author.id,
                'username': self.author.username,
                'nickname': self.author.nickname,
                'profile_picture': self.author.profile_picture,
            }
        return data


class ReviewReaction(db.Model):
    __tablename__ = 'review_reactions'  
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False) 
    review_id = db.Column(db.Integer, db.ForeignKey('reviews.id'), nullable=False)  
    is_like = db.Column(db.Boolean, nullable=False)  # True = Like, False = Dislike
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (db.UniqueConstraint('user_id', 'review_id', name='uid_rid_unique_reaction'),)