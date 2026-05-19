from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
from sqlalchemy.orm import backref

db = SQLAlchemy()

# association tables at the top, use table names not class
movie_list = db.Table('movie_list',
    db.Column('movie_id', db.Integer, db.ForeignKey('movies.id'), primary_key=True),
    db.Column('list_id', db.Integer, db.ForeignKey('movielists.id'), primary_key=True)
)

show_list = db.Table('show_list',
    db.Column('show_id', db.Integer, db.ForeignKey('shows.id'), primary_key=True),
    db.Column('list_id', db.Integer, db.ForeignKey('movielists.id'), primary_key=True)
)

club_members = db.Table('club_members',
    db.Column('user_id', db.Integer, db.ForeignKey('users.id'), primary_key=True),
    db.Column('club_id', db.Integer, db.ForeignKey('clubs.id'), primary_key=True)
)

# user
class user(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    discord_id = db.Column(db.String(64), unique=True, nullable=True)  # nullable for testing
    username = db.Column(db.String(32), nullable=False, unique=True)
    nickname = db.Column(db.String(16), nullable=True)
    password_hash = db.Column(db.String(256), nullable=False)
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
    
    # relationships
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

# movies
class movie(db.Model):
    __tablename__ = 'movies'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    posterURL = db.Column(db.String(200))
    tmdbID = db.Column(db.Integer)
    userID = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    def __repr__(self):
        return f"Movie('{self.title}')"

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'poster_url': self.posterURL,
            'tmdb_id': self.tmdbID,
            'user_id': self.userID
        }

# shows
class show(db.Model):
    __tablename__ = 'shows'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    posterURL = db.Column(db.String(200))
    tmdbID = db.Column(db.Integer)
    userID = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
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
            'poster_url': self.posterURL,
            'tmdb_id': self.tmdbID,
            'user_id': self.userID,
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


# clubs
class club(db.Model):
    __tablename__ = 'clubs'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    description = db.Column(db.String(500))
    image_url = db.Column(db.String(300), nullable=True)
    admin_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    mod_ids = db.Column(db.JSON, default=list)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # club owns multiple lists (if club is gone, lists are gone) 
    lists = db.relationship('movielist', backref='club', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f"Club('{self.name}')"

    def is_member(self, user):
        return user in self.members

    def is_mod(self, user):
        return user.id in (self.mod_ids or [])

    def can_manage(self, user):
        return user.id == self.admin_id or self.is_mod(user)

    def add_member(self, user):
        if user not in self.members:
            self.members.append(user)

    def remove_member(self, user):
        if user in self.members:
            self.members.remove(user)

    def to_dict(self, include_members=False, include_lists=False, include_name_history=False):
        data = {
            'id': self.id,
            'name': self.name,
            'description': self.description or '',
            'image_url': self.image_url,
            'admin_id': self.admin_id,
            'mod_ids': self.mod_ids or [],
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        
        if include_members:
            data['members'] = [m.to_dict() for m in self.members]
        else:
            data['member_count'] = len(self.members)
        
        if include_lists:
            data['lists'] = [lst.to_dict(include_movies=True, include_shows=True) for lst in self.lists]
        
        if include_name_history:
            data['name_history'] = self.get_name_history()
        
        return data
    
    def get_name_history(self):
        return [
            {
                'name': h.old_name,
                'changed_at': h.changed_at.isoformat() if h.changed_at else None,
                'changed_by': h.changed_by_user_id
            }
            for h in self.name_history.order_by(club_name_history.changed_at.desc()).all()
        ]


class club_name_history(db.Model):
    __tablename__ = 'club_name_history'
    
    id = db.Column(db.Integer, primary_key=True)
    club_id = db.Column(db.Integer, db.ForeignKey('clubs.id'), nullable=False)
    old_name = db.Column(db.String(50), nullable=False)
    changed_at = db.Column(db.DateTime, default=datetime.utcnow)
    changed_by_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    club = db.relationship('club', backref=db.backref('name_history', lazy='dynamic', cascade='all, delete-orphan'))
    
    def __repr__(self):
        return f"ClubNameHistory('{self.old_name}', club_id={self.club_id})"


# lists
class movielist(db.Model):
    __tablename__ = 'movielists'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    userID = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    club_id = db.Column(db.Integer, db.ForeignKey('clubs.id'), nullable=True)

    movies = db.relationship('movie', secondary=movie_list, backref='lists', lazy=True)
    shows = db.relationship('show', secondary=show_list, backref='show_lists', lazy=True)

    def __repr__(self):
        return f"List('{self.name}')"

    def is_club_list(self):
        return self.club_id is not None

    def is_personal_list(self):
        return self.userID is not None

    def can_edit(self, user):
        if self.is_personal_list():
            return self.userID == user.id
        elif self.is_club_list():
            return self.club.is_member(user)
        return False

    def to_dict(self, include_movies=False, include_shows=False):
        data = {
            'id': self.id,
            'name': self.name,
            'user_id': self.userID,
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


# activity logs
class activity_log(db.Model):
    __tablename__ = 'activity_logs'

    id = db.Column(db.Integer, primary_key=True)
    event_type = db.Column(db.String(50), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    club_id = db.Column(db.Integer, db.ForeignKey('clubs.id'), nullable=True)
    list_id = db.Column(db.Integer, db.ForeignKey('movielists.id'), nullable=True)
    movie_id = db.Column(db.Integer, db.ForeignKey('movies.id'), nullable=True)
    show_id = db.Column(db.Integer, db.ForeignKey('shows.id'), nullable=True)
    target_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    description = db.Column(db.Text, nullable=False)
    data = db.Column(db.JSON, default=dict)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # relationships
    actor = db.relationship('user', foreign_keys=[user_id], backref='activities')
    target_user = db.relationship('user', foreign_keys=[target_user_id])
    club = db.relationship('club', backref='activities')
    movie = db.relationship('movie')
    show = db.relationship('show')
    list_obj = db.relationship('movielist')

    def __repr__(self):
        return f"ActivityLog('{self.event_type}', user={self.user_id})"

    def to_dict(self, include_actor=False):
        data = {
            'id': self.id,
            'event_type': self.event_type,
            'user_id': self.user_id,
            'club_id': self.club_id,
            'list_id': self.list_id,
            'movie_id': self.movie_id,
            'show_id': self.show_id,
            'target_user_id': self.target_user_id,
            'description': self.description or '',
            'data': self.data or {},
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if include_actor and self.actor:
            data['actor'] = self.actor.to_dict()
        return data


class Review(db.Model):
    __tablename__ = 'reviews'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    tmdb_id = db.Column(db.Integer, nullable=False)
    media_type = db.Column(db.String(10), nullable=False)  # 'movie' or 'tv'
    title = db.Column(db.String(200))
    poster_url = db.Column(db.String(300))
    rating = db.Column(db.Float, nullable=True)   # 0.5–5 stars
    content = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

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


class ShowProgress(db.Model):
    __tablename__ = 'show_progress'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    show_id = db.Column(db.Integer, nullable=False)  # TMDB show ID
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
    movie_id = db.Column(db.Integer, nullable=False)  # TMDB movie ID
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


class UserSettings(db.Model):
    __tablename__ = 'user_settings'
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), primary_key=True)
    displayed_list = db.Column(db.Integer, nullable=True)
    pinned_lists = db.Column(db.JSON, default=list)
    pinned_clubs = db.Column(db.JSON, default=list)
    theme = db.Column(db.String(20), default='dark')

    user = db.relationship('user', backref=db.backref('settings', uselist=False))

    def to_dict(self):
        return {
            'user_id': self.user_id,
            'displayed_list': self.displayed_list,
            'pinned_lists': self.pinned_lists or [],
            'pinned_clubs': self.pinned_clubs or [],
            'theme': self.theme or 'dark',
        }

        