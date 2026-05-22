from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from models import db, user, UserSettings

settings = Blueprint('settings', __name__)


@settings.route('/', methods=['GET'])
@jwt_required()
def get_settings():
    user_id = int(get_jwt_identity())
    user_obj = user.query.get(user_id)
    if not user_obj:
        return jsonify({'error': 'User not found'}), 404

    if not user_obj.settings:
        us = UserSettings(user_id=user_id)
        db.session.add(us)
        db.session.commit()

    return jsonify(user_obj.settings.to_dict()), 200


@settings.route('/', methods=['PUT'])
@jwt_required()
def save_settings():
    user_id = int(get_jwt_identity())
    user_obj = user.query.get(user_id)
    if not user_obj:
        return jsonify({'error': 'User not found'}), 404

    if not user_obj.settings:
        us = UserSettings(user_id=user_id)
        db.session.add(us)
        db.session.commit()

    data = request.get_json()
    if 'displayed_list' in data:
        user_obj.settings.displayed_list = data['displayed_list']
    if 'pinned_lists' in data:
        user_obj.settings.pinned_lists = data['pinned_lists']
    if 'pinned_clubs' in data:
        user_obj.settings.pinned_clubs = data['pinned_clubs']
    if 'theme' in data:
        user_obj.settings.theme = data['theme']

    db.session.commit()
    return jsonify(user_obj.settings.to_dict()), 200
