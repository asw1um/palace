from .database import db, movie_list, show_list


class movielist(db.Model):
    __tablename__ = 'movielists'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    club_id = db.Column(db.Integer, db.ForeignKey('clubs.id'), nullable=True)

    movies = db.relationship('movie', secondary=movie_list, backref='lists', lazy=True)
    shows = db.relationship('show', secondary=show_list, backref='show_lists', lazy=True)

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

    def to_dict(self, include_movies=False, include_shows=False):
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
            data['movies'] = [m.to_dict() for m in self.movies]
        if include_shows:
            try:
                data['show_count'] = len(self.shows)
                data['shows'] = [s.to_dict(include_seasons=True) for s in self.shows]
            except Exception:
                data['show_count'] = 0
                data['shows'] = []
        return data
