from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from dbstruct import db, user, club, movielist
from activity import log_event

clubs = Blueprint('clubs', __name__)

# fetch all clubs 
@clubs.route('/', methods=['GET'])
@jwt_required()
def get_clubs():
    user_id = int(get_jwt_identity())
    current_user = user.query.get(user_id)
    
    return jsonify({
        'my_clubs': [c.to_dict() for c in current_user.clubs],
        'all_clubs': [c.to_dict() for c in club.query.all()]
    }), 200

# create club
@clubs.route('/', methods=['POST'])
@jwt_required()
def create_club():
    user_id = int(get_jwt_identity())
    data = request.get_json()
    club_name = data.get('name', '').strip()
    description = data.get('description', '')
    
    if not club_name:
        return jsonify({'error': 'Club name cannot be empty'}), 400
    
    current_user = user.query.get(user_id)
    
    # creator becomes admin (stored in admin_id)
    new_club = club(
        name=club_name,
        description=description,
        admin_id=user_id
    )
    new_club.members.append(current_user)
    
    db.session.add(new_club)
    db.session.commit()

    log_event(
        event_type='user_created_club',
        user_id=user_id,
        club_id=new_club.id,
        description=f"Created club: {club_name}",
        extra_data={'club_name': club_name}
    )
    
    return jsonify({
        'message': f'Created club: {club_name}',
        'club': new_club.to_dict()
    }), 201

# club details
@clubs.route('/<int:club_id>', methods=['GET'])
@jwt_required()
def get_club(club_id):
    club_obj = club.query.get_or_404(club_id)
    
    return jsonify({
        'club': club_obj.to_dict(include_members=True, include_lists=True)
    }), 200

# user join club
@clubs.route('/<int:club_id>/join', methods=['POST'])
@jwt_required()
def join_club(club_id):
    user_id = int(get_jwt_identity())
    current_user = user.query.get(user_id)
    club_obj = club.query.get_or_404(club_id)
    
    if club_obj.is_member(current_user):
        return jsonify({'error': 'Already a member'}), 400
    
    club_obj.add_member(current_user)
    db.session.commit()

    log_event(
        event_type='user_joined_club',
        user_id=user_id,
        club_id=club_obj.id,
        description=f"Joined club: {club_obj.name} ({len(club_obj.members)} members)",
        extra_data={'club_name': club_obj.name, 'member_count': len(club_obj.members)}
    )
    
    return jsonify({'message': f'Joined club: {club_obj.name}'}), 200

# user leave club
@clubs.route('/<int:club_id>/leave', methods=['POST'])
@jwt_required()
def leave_club(club_id):
    user_id = int(get_jwt_identity())
    current_user = user.query.get(user_id)
    club_obj = club.query.get_or_404(club_id)
    
    if not club_obj.is_member(current_user):
        return jsonify({'error': 'Not a member'}), 400
    
    club_obj.remove_member(current_user)
    db.session.commit()

    log_event(
        event_type='user_left_club',
        user_id=user_id,
        club_id=club_obj.id,
        description=f"Left club: {club_obj.name}",
        extra_data={'club_name': club_obj.name}
    )
    
    return jsonify({'message': f'Left club: {club_obj.name}'}), 200

# create lists IN clubs
@clubs.route('/<int:club_id>/lists', methods=['POST'])
@jwt_required()
def create_club_list(club_id):
    user_id = int(get_jwt_identity())
    current_user = user.query.get(user_id)
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
    
    return jsonify({
        'message': f'Created list: {list_name}',
        'list': new_list.to_dict()
    }), 201

# delete user list IN club
@clubs.route('/<int:club_id>/lists/<int:list_id>', methods=['DELETE'])
@jwt_required()
def delete_club_list(club_id, list_id):
    user_id = int(get_jwt_identity())
    current_user = user.query.get(user_id)
    list_obj = movielist.query.get_or_404(list_id)
    
    # check if user is club member
    club_obj = club.query.get_or_404(club_id)
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

# rename club
@clubs.route('/<int:club_id>/rename', methods=['POST'])
@jwt_required()
def rename_club(club_id):
    user_id = int(get_jwt_identity())
    club_obj = club.query.get_or_404(club_id)
    
    if club_obj.admin_id != user_id:
        return jsonify({'error': 'Only admin can rename'}), 403
    
    data = request.get_json()
    new_name = data.get('name', '').strip()
    if not new_name:
        return jsonify({'error': 'Name cannot be empty'}), 400
    
    old_name = club_obj.name
    club_obj.name = new_name
    db.session.commit()

    log_event(
        event_type='user_renamed_club',
        user_id=user_id,
        club_id=club_obj.id,
        description=f"Renamed club from '{old_name}' to '{new_name}'",
        extra_data={'old_name': old_name, 'new_name': new_name}
    )
    
    return jsonify({
        'message': f'Renamed club to: {new_name}',
        'club': club_obj.to_dict()
    }), 200

# rename club list
@clubs.route('/<int:club_id>/lists/<int:list_id>/rename', methods=['POST'])
@jwt_required()
def rename_club_list(club_id, list_id):
    user_id = int(get_jwt_identity())
    current_user = user.query.get(user_id)
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
    
    return jsonify({
        'message': f'Renamed list to: {new_name}',
        'list': list_obj.to_dict()
    }), 200

# delete clubs
@clubs.route('/<int:club_id>', methods=['DELETE'])
@jwt_required()
def delete_club(club_id):
    user_id = int(get_jwt_identity())
    club_obj = club.query.get_or_404(club_id)
    
    if club_obj.admin_id != user_id:
        return jsonify({'error': 'Only admin can delete'}), 403
    
    club_name = club_obj.name

    log_event(
        event_type='user_deleted_club',
        user_id=user_id,
        club_id=club_obj.id,
        description=f"Deleted club: {club_name}",
        extra_data={'club_name': club_name}
    )

    db.session.delete(club_obj)
    db.session.commit()
    
    return jsonify({'message': f'Deleted club: {club_name}'}), 200

# pin club
@clubs.route('/<int:club_id>/pin', methods=['POST'])
@jwt_required()
def pin_club(club_id):
    user_id = int(get_jwt_identity())
    current_user = user.query.get(user_id)
    club_obj = club.query.get_or_404(club_id)
    
    pinned = current_user.pinned_club_ids or []
    if club_id not in pinned:
        pinned.append(club_id)
        current_user.pinned_club_ids = pinned
        db.session.commit()
    
    return jsonify({'message': 'Club pinned'}), 200

# unpin club
@clubs.route('/<int:club_id>/unpin', methods=['POST'])
@jwt_required()
def unpin_club(club_id):
    user_id = int(get_jwt_identity())
    current_user = user.query.get(user_id)
    
    pinned = current_user.pinned_club_ids or []
    if club_id in pinned:
        pinned.remove(club_id)
        current_user.pinned_club_ids = pinned
        db.session.commit()
    
    return jsonify({'message': 'Club unpinned'}), 200

# get pinned clubs
@clubs.route('/pinned', methods=['GET'])
@jwt_required()
def get_pinned_clubs():
    user_id = int(get_jwt_identity())
    current_user = user.query.get(user_id)
    pinned_ids = current_user.pinned_club_ids or []
    
    pinned = club.query.filter(club.id.in_(pinned_ids)).all()
    return jsonify({'clubs': [c.to_dict() for c in pinned]}), 200

#get club lists
@clubs.route('/my-clubs-with-lists', methods=['GET'])
@jwt_required()
def get_my_clubs_with_lists():
    user_id = int(get_jwt_identity())
    current_user = user.query.get(user_id)
    
    clubs_data = []
    for c in current_user.clubs:
        club_data = c.to_dict()
        club_data['lists'] = [lst.to_dict(include_movies=True, include_shows=True) for lst in c.lists]
        clubs_data.append(club_data)
    
    return jsonify({'clubs': clubs_data}), 200
