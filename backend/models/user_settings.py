from .database import db


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
