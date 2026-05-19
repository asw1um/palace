from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from dbstruct import db

notifications = Blueprint('notifications', __name__)

# base
class Notification(db.Model):
    __tablename__ = 'notifications'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # tells SQLAlchemy which subclass to use
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
        now = datetime.utcnow()
        diff = now - self.created_at
        seconds = int(diff.total_seconds())
        
        if seconds < 60:
            return "just now"
        elif seconds < 3600:  # > 1 hr
            minutes = seconds // 60
            return f"{minutes}m" if minutes > 1 else "1m"
        elif seconds < 86400:  # > 1 day
            hours = seconds // 3600
            return f"{hours}h" if hours > 1 else "1h"
        elif seconds < 604800:  # > 1 week
            days = seconds // 86400
            return f"{days}d" if days > 1 else "1d"
        elif seconds < 2592000:  # > 1 month
            weeks = seconds // 604800
            return f"{weeks}w" if weeks > 1 else "1w"
        else:
            months = seconds // 2592000
            return f"{months}mo" if months > 1 else "1mo"
    
    def mark_read(self):
        self.is_read = True
        db.session.commit()
    
    def mark_unread(self):
        self.is_read = False
        db.session.commit()
    
    def delete(self):
        db.session.delete(self)
        db.session.commit()

# user
class ClubInviteNotification(Notification):

    __mapper_args__ = {'polymorphic_identity': 'club_invite'}
    
    def accept(self):
        from dbstruct import club, user
        
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
    
    # expected data: {review_id, movie_id, movie_title, mentioned_by_user_id, mentioned_by_name, excerpt}
    
    def get_navigation_url(self):
        pass

class ClubDeletedNotification(Notification):
    __mapper_args__ = {'polymorphic_identity': 'club_deleted'}
    
    # expected: {club_name, deleted_by_user_id, deleted_by_name}

# all members of club
class ClubBroadcastNotification(Notification):
    __mapper_args__ = {'polymorphic_identity': 'club_broadcast'}

    @classmethod
    def broadcast_to_club(cls, club_id, exclude_user_id=None, **kwargs):
        from dbstruct import club
        
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
                data={
                    'club_id': club_id,
                    'club_name': club_obj.name,
                    **kwargs
                }
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
        new_member_name = kwargs.get('new_member_name', 'Someone')
        return f"{new_member_name} joined the club."


class ClubMemberLeftNotification(ClubBroadcastNotification):
    __mapper_args__ = {'polymorphic_identity': 'club_member_left'}
    
    @classmethod
    def _get_title(cls, **kwargs):
        return "Member Left"
    
    @classmethod
    def _get_message(cls, **kwargs):
        left_user_name = kwargs.get('left_user_name', 'Someone')
        return f"{left_user_name} left the club."


class ClubMovieAddedNotification(ClubBroadcastNotification):
    __mapper_args__ = {'polymorphic_identity': 'club_movie_added'}
    
    @classmethod
    def _get_title(cls, **kwargs):
        return "Movie Added"
    
    @classmethod
    def _get_message(cls, **kwargs):
        movie_title = kwargs.get('movie_title', 'A movie')
        return f"'{movie_title}' was added to the club."


class ClubListAddedNotification(ClubBroadcastNotification):
    __mapper_args__ = {'polymorphic_identity': 'club_list_added'}
    
    @classmethod
    def _get_title(cls, **kwargs):
        return "List Added"
    
    @classmethod
    def _get_message(cls, **kwargs):
        list_name = kwargs.get('list_name', 'A list')
        return f"'{list_name}' was added to the club."


class ClubListDeletedNotification(ClubBroadcastNotification):
    __mapper_args__ = {'polymorphic_identity': 'club_list_deleted'}
    
    @classmethod
    def _get_title(cls, **kwargs):
        return "List Deleted"
    
    @classmethod
    def _get_message(cls, **kwargs):
        list_name = kwargs.get('list_name', 'A list')
        return f"'{list_name}' was deleted from the club."


class ClubNameChangeNotification(ClubBroadcastNotification):
    __mapper_args__ = {'polymorphic_identity': 'club_name_change'}
    
    @classmethod
    def _get_title(cls, **kwargs):
        return "Club Renamed"
    
    @classmethod
    def _get_message(cls, **kwargs):
        old_name = kwargs.get('old_name', 'Old Name')
        new_name = kwargs.get('new_name', 'New Name')
        return f"Club renamed from '{old_name}' to '{new_name}'."


class ClubListNameChangeNotification(ClubBroadcastNotification):
    __mapper_args__ = {'polymorphic_identity': 'club_list_name_change'}
    
    @classmethod
    def _get_title(cls, **kwargs):
        return "List Renamed"
    
    @classmethod
    def _get_message(cls, **kwargs):
        old_name = kwargs.get('old_name', 'Old Name')
        new_name = kwargs.get('new_name', 'New Name')
        return f"List renamed from '{old_name}' to '{new_name}'."

# routes
@notifications.route('/user', methods=['GET'])
@jwt_required()
def get_user_notifications():
    user_id = int(get_jwt_identity())
    notifs = Notification.query.filter_by(user_id=user_id).order_by(Notification.created_at.desc()).all()
    return jsonify({'notifications': [n.to_dict() for n in notifs]}), 200


@notifications.route('/user/<int:notification_id>/read', methods=['POST'])
@jwt_required()
def mark_user_notification_read(notification_id):
    user_id = int(get_jwt_identity())
    notif = Notification.query.filter_by(id=notification_id, user_id=user_id).first_or_404()
    notif.mark_read()
    return jsonify({'message': 'Marked as read'}), 200


@notifications.route('/user/<int:notification_id>/unread', methods=['POST'])
@jwt_required()
def mark_user_notification_unread(notification_id):
    user_id = int(get_jwt_identity())
    notif = Notification.query.filter_by(id=notification_id, user_id=user_id).first_or_404()
    notif.mark_unread()
    return jsonify({'message': 'Marked as unread'}), 200


@notifications.route('/user/<int:notification_id>', methods=['DELETE'])
@jwt_required()
def delete_user_notification(notification_id):
    user_id = int(get_jwt_identity())
    notif = Notification.query.filter_by(id=notification_id, user_id=user_id).first_or_404()
    notif.delete()
    return jsonify({'message': 'Notification deleted'}), 200


@notifications.route('/user/read-all', methods=['POST'])
@jwt_required()
def mark_all_user_notifications_read():
    user_id = int(get_jwt_identity())
    Notification.query.filter_by(user_id=user_id, is_read=False).update({'is_read': True})
    db.session.commit()
    return jsonify({'message': 'All notifications marked as read'}), 200


# action notifications
@notifications.route('/invite/<int:notification_id>/accept', methods=['POST'])
@jwt_required()
def accept_invite(notification_id):
    user_id = int(get_jwt_identity())
    notif = ClubInviteNotification.query.filter_by(id=notification_id, user_id=user_id).first_or_404()
    club_obj = notif.accept()
    return jsonify({'message': f"Joined club: {club_obj.name}"}), 200


@notifications.route('/invite/<int:notification_id>/decline', methods=['POST'])
@jwt_required()
def decline_invite(notification_id):
    user_id = int(get_jwt_identity())
    notif = ClubInviteNotification.query.filter_by(id=notification_id, user_id=user_id).first_or_404()
    notif.decline()
    return jsonify({'message': 'Invite declined'}), 200
