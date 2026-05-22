from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Notification, ClubInviteNotification

notifications = Blueprint('notifications', __name__)

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
