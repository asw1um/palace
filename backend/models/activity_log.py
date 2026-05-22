from datetime import datetime
from .database import db


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
