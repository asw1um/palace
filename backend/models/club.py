from datetime import datetime
from .database import db


class club(db.Model):
    __tablename__ = 'clubs'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    description = db.Column(db.String(500))
    image_url = db.Column(db.String(300), nullable=True)
    admin_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    mod_ids = db.Column(db.JSON, default=list)
    helper_ids = db.Column(db.JSON, default=list)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    lists = db.relationship('movielist', backref='club', lazy=True, cascade='all, delete-orphan')

    def __repr__(self):
        return f"Club('{self.name}')"

    def is_member(self, user):
        return user in self.members

    def is_helper(self, user):
        return user.id in (self.helper_ids or [])

    def is_mod(self, user):
        return user.id in (self.mod_ids or [])

    def can_manage_lists(self, user):
        # helper, mod, and admin can add/remove items from lists (created this for saftey)
        return user.id == self.admin_id or self.is_mod(user) or self.is_helper(user)

    def can_manage(self, user):
        # mod and admin can rename/change image/manage list structure 
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
            'helper_ids': self.helper_ids or [],
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
