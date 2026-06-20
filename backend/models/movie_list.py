from .database import db, movie_list, show_list
from datetime import datetime, timezone

class movielist(db.Model):
    __tablename__ = 'movielists'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    club_id = db.Column(db.Integer, db.ForeignKey('clubs.id'), nullable=True)

    movies = db.relationship('movie', secondary=movie_list, backref='lists', lazy=True)
    shows = db.relationship('show', secondary=show_list, backref='show_lists', lazy=True)
    updated_at = db.Column(db.DateTime, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))

    def __repr__(self):
        return f"List('{self.name}')"

    def is_club_list(self):
        return self.club_id is not None

    def is_personal_list(self):
        return self.user_id is not None

    def can_edit(self, user):
        if self.is_personal_list():
            return self.user_id == user.id
        elif self.is_club_list():
            return self.club.can_manage_lists(user)
        return False

    def to_dict(self, include_movies=False, include_shows=False, movie_sort = 'default', show_sort = 'default'):
        data = {
            'id': self.id,
            'name': self.name,
            'user_id': self.user_id,
            'club_id': self.club_id,
            'type': 'club' if self.is_club_list() else 'personal',
            'movie_count': len(self.movies),
            'show_count': 0,
        }
        if include_movies:
            movies_list = list(self.movies)
            if movie_sort == 'name':
                movies_list.sort(key=lambda m: m.title.lower())
            elif movie_sort == 'newest':
                # Since your Movie model has an 'id' (auto-incrementing), 
                # higher ID usually means added more recently
                movies_list.sort(key=lambda m: m.id, reverse=True)
            data['movies'] = [m.to_dict() for m in self.movies]
        if include_shows:
            try:
                shows_list = list(self.shows)
                
                if show_sort == 'name':
                    shows_list.sort(key=lambda s: s.title.lower())
                elif show_sort == 'newest':
                    shows_list.sort(key=lambda s: s.id, reverse=True)
                data['show_count'] = len(shows_list)
                data['shows'] = [s.to_dict(include_seasons=True) for s in self.shows]
            except Exception:
                data['show_count'] = 0
                data['shows'] = []
        return data
