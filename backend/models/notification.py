from datetime import datetime
from .database import db
from utils import time_ago


class Notification(db.Model):
    __tablename__ = 'notifications'

    id = db.Column(db.Integer, primary_key=True)
    type = db.Column(db.String(50), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(100), nullable=False)
    message = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    data = db.Column(db.JSON, default=dict)

    __mapper_args__ = {
        'polymorphic_on': type,
        'polymorphic_identity': 'notification'
    }

    def to_dict(self):
        return {
            'id': self.id,
            'type': self.type,
            'title': self.title,
            'message': self.message,
            'is_read': self.is_read,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'time_ago': self.get_time_ago(),
            'data': self.data
        }

    def get_time_ago(self):
        return time_ago(self.created_at)

    def mark_read(self):
        self.is_read = True
        db.session.commit()

    def mark_unread(self):
        self.is_read = False
        db.session.commit()

    def delete(self):
        db.session.delete(self)
        db.session.commit()


class ClubInviteNotification(Notification):
    __mapper_args__ = {'polymorphic_identity': 'club_invite'}

    def accept(self):
        from models.club import club
        from models.user import user

        club_obj = club.query.get(self.data['club_id'])
        if not club_obj:
            raise ValueError("Club no longer exists")
        invited_user = user.query.get(self.user_id)
        if not invited_user:
            raise ValueError("User not found")
        club_obj.add_member(invited_user)
        self.delete()
        ClubNewMemberNotification.broadcast_to_club(
            club_id=club_obj.id,
            exclude_user_id=self.user_id,
            new_member_user_id=self.user_id,
            new_member_name=invited_user.display_name
        )
        return club_obj

    def decline(self):
        self.delete()


class UserMentionNotification(Notification):
    __mapper_args__ = {'polymorphic_identity': 'user_mention'}


class ClubDeletedNotification(Notification):
    __mapper_args__ = {'polymorphic_identity': 'club_deleted'}


class ClubBroadcastNotification(Notification):
    __mapper_args__ = {'polymorphic_identity': 'club_broadcast'}

    @classmethod
    def broadcast_to_club(cls, club_id, exclude_user_id=None, **kwargs):
        from models.club import club
        club_obj = club.query.get(club_id)
        if not club_obj:
            return []
        notifications = []
        for member in club_obj.members:
            if exclude_user_id and member.id == exclude_user_id:
                continue
            notif = cls(
                user_id=member.id,
                title=cls._get_title(**kwargs),
                message=cls._get_message(**kwargs),
                data={'club_id': club_id, 'club_name': club_obj.name, **kwargs}
            )
            db.session.add(notif)
            notifications.append(notif)
        db.session.commit()
        return notifications

    @classmethod
    def _get_title(cls, **kwargs):
        raise NotImplementedError(f"{cls.__name__} must implement _get_title()")

    @classmethod
    def _get_message(cls, **kwargs):
        raise NotImplementedError(f"{cls.__name__} must implement _get_message()")


class ClubNewMemberNotification(ClubBroadcastNotification):
    __mapper_args__ = {'polymorphic_identity': 'club_new_member'}

    @classmethod
    def _get_title(cls, **kwargs):
        return "New Member"

    @classmethod
    def _get_message(cls, **kwargs):
        return f"{kwargs.get('new_member_name', 'Someone')} joined the club."


class ClubMemberLeftNotification(ClubBroadcastNotification):
    __mapper_args__ = {'polymorphic_identity': 'club_member_left'}

    @classmethod
    def _get_title(cls, **kwargs):
        return "Member Left"

    @classmethod
    def _get_message(cls, **kwargs):
        return f"{kwargs.get('left_user_name', 'Someone')} left the club."


class ClubMovieAddedNotification(ClubBroadcastNotification):
    __mapper_args__ = {'polymorphic_identity': 'club_movie_added'}

    @classmethod
    def _get_title(cls, **kwargs):
        return "Movie Added"

    @classmethod
    def _get_message(cls, **kwargs):
        return f"'{kwargs.get('movie_title', 'A movie')}' was added to the club."


class ClubListAddedNotification(ClubBroadcastNotification):
    __mapper_args__ = {'polymorphic_identity': 'club_list_added'}

    @classmethod
    def _get_title(cls, **kwargs):
        return "List Added"

    @classmethod
    def _get_message(cls, **kwargs):
        return f"'{kwargs.get('list_name', 'A list')}' was added to the club."


class ClubListDeletedNotification(ClubBroadcastNotification):
    __mapper_args__ = {'polymorphic_identity': 'club_list_deleted'}

    @classmethod
    def _get_title(cls, **kwargs):
        return "List Deleted"

    @classmethod
    def _get_message(cls, **kwargs):
        return f"'{kwargs.get('list_name', 'A list')}' was deleted from the club."


class ClubNameChangeNotification(ClubBroadcastNotification):
    __mapper_args__ = {'polymorphic_identity': 'club_name_change'}

    @classmethod
    def _get_title(cls, **kwargs):
        return "Club Renamed"

    @classmethod
    def _get_message(cls, **kwargs):
        return f"Club renamed from '{kwargs.get('old_name', 'Old Name')}' to '{kwargs.get('new_name', 'New Name')}'."


class ClubListNameChangeNotification(ClubBroadcastNotification):
    __mapper_args__ = {'polymorphic_identity': 'club_list_name_change'}

    @classmethod
    def _get_title(cls, **kwargs):
        return "List Renamed"

    @classmethod
    def _get_message(cls, **kwargs):
        return f"List renamed from '{kwargs.get('old_name', 'Old Name')}' to '{kwargs.get('new_name', 'New Name')}'."
