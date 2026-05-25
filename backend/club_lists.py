from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from models import db, user, club, movielist
from activity import log_event

club_lists = Blueprint('club_lists', __name__)


@club_lists.route('/<int:club_id>/lists', methods=['POST'])
@jwt_required()
def create_club_list(club_id):
    user_id = int(get_jwt_identity())
    current_user = db.session.get(user,user_id)
    club_obj = club.query.get_or_404(club_id)

    if not club_obj.is_member(current_user):
        return jsonify({'error': 'Must be a member to create lists'}), 403

    data = request.get_json()
    list_name = data.get('name', '').strip()
    if not list_name:
        return jsonify({'error': 'List name cannot be empty'}), 400

    new_list = movielist(name=list_name, club_id=club_id)
    db.session.add(new_list)
    db.session.commit()

    log_event(
        event_type='user_created_club_list',
        user_id=user_id,
        club_id=club_id,
        list_id=new_list.id,
        description=f"Created list '{list_name}' in club {club_obj.name}",
        extra_data={'list_name': list_name, 'club_name': club_obj.name}
    )

    return jsonify({'message': f'Created list: {list_name}', 'list': new_list.to_dict()}), 201


@club_lists.route('/<int:club_id>/lists/<int:list_id>', methods=['DELETE'])
@jwt_required()
def delete_club_list(club_id, list_id):
    user_id = int(get_jwt_identity())
    current_user = db.session.get(user,user_id)
    club_obj = club.query.get_or_404(club_id)
    list_obj = movielist.query.get_or_404(list_id)

    if not club_obj.is_member(current_user):
        return jsonify({'error': 'Not a member'}), 403

    if list_obj.club_id != club_id:
        return jsonify({'error': 'List not in this club'}), 403

    log_event(
        event_type='user_deleted_club_list',
        user_id=user_id,
        club_id=club_id,
        list_id=list_obj.id,
        description=f"Deleted list '{list_obj.name}' from club {club_obj.name}",
        extra_data={'list_name': list_obj.name, 'club_name': club_obj.name}
    )

    db.session.delete(list_obj)
    db.session.commit()
    return jsonify({'message': 'List deleted'}), 200


@club_lists.route('/<int:club_id>/lists/<int:list_id>/rename', methods=['POST'])
@jwt_required()
def rename_club_list(club_id, list_id):
    user_id = int(get_jwt_identity())
    current_user = db.session.get(user,user_id)
    club_obj = club.query.get_or_404(club_id)
    list_obj = movielist.query.get_or_404(list_id)

    if not club_obj.is_member(current_user):
        return jsonify({'error': 'Not a member'}), 403

    if list_obj.club_id != club_id:
        return jsonify({'error': 'List not in this club'}), 403

    data = request.get_json()
    new_name = data.get('name', '').strip()
    if not new_name:
        return jsonify({'error': 'Name cannot be empty'}), 400

    old_name = list_obj.name
    list_obj.name = new_name
    db.session.commit()

    log_event(
        event_type='user_renamed_club_list',
        user_id=user_id,
        club_id=club_id,
        list_id=list_obj.id,
        description=f"Renamed list from '{old_name}' to '{new_name}' in club {club_obj.name}",
        extra_data={'old_name': old_name, 'new_name': new_name, 'club_name': club_obj.name}
    )

    return jsonify({'message': f'Renamed list to: {new_name}', 'list': list_obj.to_dict()}), 200
