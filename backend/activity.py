from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from dbstruct import db, activity_log, user, club, movielist

activity = Blueprint('activity', __name__)

def log_event(event_type, user_id=None, club_id=None, list_id=None,
              movie_id=None, show_id=None, target_user_id=None,
              description=None, extra_data=None):
    entry = activity_log(
        event_type=event_type,
        user_id=user_id,
        club_id=club_id,
        list_id=list_id,
        movie_id=movie_id,
        show_id=show_id,
        target_user_id=target_user_id,
        description=description or '',
        data=extra_data or {}
    )
    db.session.add(entry)
    db.session.commit()
    return entry


def get_time_ago(created_at):
    if not created_at:
        return "unknown"
    now = datetime.utcnow()
    diff = now - created_at
    seconds = int(diff.total_seconds())

    if seconds < 60:
        return "just now"
    elif seconds < 3600:
        minutes = seconds // 60
        return f"{minutes}m" if minutes > 1 else "1m"
    elif seconds < 86400:
        hours = seconds // 3600
        return f"{hours}h" if hours > 1 else "1h"
    elif seconds < 604800:
        days = seconds // 86400
        return f"{days}d" if days > 1 else "1d"
    elif seconds < 2592000:
        weeks = seconds // 604800
        return f"{weeks}w" if weeks > 1 else "1w"
    else:
        months = seconds // 2592000
        return f"{months}mo" if months > 1 else "1mo"

#api 
@activity.route('/', methods=['GET'])
@jwt_required()
def get_all_activity():
    club_id = request.args.get('club_id', type=int)
    event_type = request.args.get('event_type')
    limit = request.args.get('limit', 50, type=int)

    query = activity_log.query

    if club_id:
        query = query.filter_by(club_id=club_id)
    if event_type:
        query = query.filter_by(event_type=event_type)

    logs = query.order_by(activity_log.created_at.desc()).limit(limit).all()
    return jsonify({
        'activities': [_log_to_dict(l) for l in logs]
    }), 200


@activity.route('/user', methods=['GET'])
@jwt_required()
def get_user_activity():
    user_id = int(get_jwt_identity())
    limit = request.args.get('limit', 50, type=int)

    logs = activity_log.query.filter(
        (activity_log.user_id == user_id) | (activity_log.target_user_id == user_id)
    ).order_by(activity_log.created_at.desc()).limit(limit).all()

    return jsonify({
        'activities': [_log_to_dict(l) for l in logs]
    }), 200


@activity.route('/club/<int:club_id>', methods=['GET'])
@jwt_required()
def get_club_activity(club_id):
    current_user_id = int(get_jwt_identity())
    current_user_obj = user.query.get(current_user_id)
    club_obj = club.query.get_or_404(club_id)

    if not club_obj.is_member(current_user_obj):
        return jsonify({'error': 'Must be a club member to view activity'}), 403

    limit = request.args.get('limit', 50, type=int)
    logs = activity_log.query.filter_by(club_id=club_id) \
        .order_by(activity_log.created_at.desc()).limit(limit).all()

    return jsonify({
        'activities': [_log_to_dict(l) for l in logs]
    }), 200


@activity.route('/global', methods=['GET'])
@jwt_required()
def get_global_activity():
    limit = request.args.get('limit', 50, type=int)

    public_types = [
        'new_user',
        'user_created_club',
        'user_joined_club',
        'user_left_club',
        'user_renamed_club',
        'user_deleted_club',
    ]
    logs = activity_log.query.filter(
        activity_log.event_type.in_(public_types)
    ).order_by(activity_log.created_at.desc()).limit(limit).all()

    return jsonify({
        'activities': [_log_to_dict(l) for l in logs]
    }), 200


def _log_to_dict(log_entry):
    data = log_entry.to_dict(include_actor=True)
    data['time_ago'] = get_time_ago(log_entry.created_at)
    return data
