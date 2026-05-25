from .database import db


class movie(db.Model):
    __tablename__ = 'movies'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    poster_url = db.Column(db.String(200))
    tmdb_id = db.Column(db.Integer)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    def __repr__(self):
        return f"Movie('{self.title}')"

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'poster_url': self.poster_url,
            'tmdb_id': self.tmdb_id,
            'user_id': self.user_id
        }


class show(db.Model):
    __tablename__ = 'shows'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    poster_url = db.Column(db.String(200))
    tmdb_id = db.Column(db.Integer)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    total_seasons = db.Column(db.Integer, default=0)
    current_season = db.Column(db.Integer, nullable=True)
    current_episode = db.Column(db.Integer, nullable=True)

    seasons = db.relationship('show_season', backref='show', lazy=True, cascade='all, delete-orphan')

    def __repr__(self):
        return f"Show('{self.title}')"

    def to_dict(self, include_seasons=False):
        data = {
            'id': self.id,
            'title': self.title,
            'poster_url': self.poster_url,
            'tmdb_id': self.tmdb_id,
            'user_id': self.user_id,
            'total_seasons': self.total_seasons,
            'current_season': self.current_season,
            'current_episode': self.current_episode,
        }
        if include_seasons:
            data['seasons'] = [s.to_dict() for s in sorted(self.seasons, key=lambda x: x.season_number)]
        return data


class show_season(db.Model):
    __tablename__ = 'show_seasons'
    id = db.Column(db.Integer, primary_key=True)
    show_id = db.Column(db.Integer, db.ForeignKey('shows.id'), nullable=False)
    season_number = db.Column(db.Integer, nullable=False)
    episode_count = db.Column(db.Integer, nullable=False)

    def to_dict(self):
        return {
            'season_number': self.season_number,
            'episode_count': self.episode_count
        }
