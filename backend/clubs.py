import os
import time
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename

from models import db, user, club, movielist
from activity import log_event

CLUB_IMAGE_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'instance', 'uploads', 'clubs')
os.makedirs(CLUB_IMAGE_FOLDER, exist_ok=True)
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def _abs_url(path):
    if not path:
        return None
    if path.startswith('http'):
        return path
    host = request.host_url.rstrip('/')
    return f"{host}{path}"


clubs = Blueprint('clubs', __name__)


@clubs.route('/', methods=['GET'])
@jwt_required()
def get_clubs():
    user_id = int(get_jwt_identity())
    current_user = db.session.get(user,user_id)

    def _club_dict(club_item):
        club_data = club_item.to_dict()
        club_data['image_url'] = _abs_url(club_data.get('image_url'))
        return club_data

    return jsonify({
        'my_clubs': [_club_dict(club_item) for club_item in current_user.clubs],
        'all_clubs': [_club_dict(club_item) for club_item in club.query.all()]
    }), 200


@clubs.route('/', methods=['POST'])
@jwt_required()
def create_club():
    user_id = int(get_jwt_identity())
    data = request.get_json()
    club_name = data.get('name', '').strip()
    description = data.get('description', '')

    if not club_name:
        return jsonify({'error': 'Club name cannot be empty'}), 400

    current_user = db.session.get(user,user_id)
    new_club = club(name=club_name, description=description, admin_id=user_id)
    new_club.members.append(current_user)
    db.session.add(new_club)
    db.session.flush()

    for default_list_name in ['Currently Watching', 'Want to Watch', 'Watched']:
        db.session.add(movielist(name=default_list_name, club_id=new_club.id))

    db.session.commit()

    log_event(
        event_type='user_created_club',
        user_id=user_id,
        club_id=new_club.id,
        description=f"Created club: {club_name}",
        extra_data={'club_name': club_name}
    )

    return jsonify({'message': f'Created club: {club_name}', 'club': new_club.to_dict()}), 201


@clubs.route('/<int:club_id>', methods=['GET'])
@jwt_required()
def get_club(club_id):
    club_obj = club.query.get_or_404(club_id)
    data = club_obj.to_dict(include_members=True, include_lists=True)
    data['image_url'] = _abs_url(data.get('image_url'))
    for member in data.get('members', []):
        member['profile_picture'] = _abs_url(member.get('profile_picture'))
        member['banner'] = _abs_url(member.get('banner'))
    return jsonify({'club': data}), 200


@clubs.route('/<int:club_id>', methods=['PUT'])
@jwt_required()
def update_club(club_id):
    user_id = int(get_jwt_identity())
    current_user = db.session.get(user,user_id)
    club_obj = club.query.get_or_404(club_id)
    if not club_obj.can_manage(current_user):
        return jsonify({'error': 'Only the club admin or a mod can edit this club'}), 403
    data = request.get_json()
    if 'name' in data and data['name'].strip():
        club_obj.name = data['name'].strip()
    if 'description' in data:
        club_obj.description = data['description'].strip()
    db.session.commit()
    result = club_obj.to_dict()
    result['image_url'] = _abs_url(result.get('image_url'))
    return jsonify({'club': result}), 200


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


@clubs.route('/<int:club_id>/rename', methods=['POST'])
@jwt_required()
def rename_club(club_id):
    user_id = int(get_jwt_identity())
    current_user = db.session.get(user,user_id)
    club_obj = club.query.get_or_404(club_id)
    if not club_obj.can_manage(current_user):
        return jsonify({'error': 'Only admin or mod can rename'}), 403

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

    return jsonify({'message': f'Renamed club to: {new_name}', 'club': club_obj.to_dict()}), 200


@clubs.route('/<int:club_id>/upload-image', methods=['POST'])
@jwt_required()
def upload_club_image(club_id):
    user_id = int(get_jwt_identity())
    current_user = db.session.get(user,user_id)
    club_obj = club.query.get_or_404(club_id)
    if not club_obj.can_manage(current_user):
        return jsonify({'error': 'Only the club admin or a mod can change the club image'}), 403
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    file = request.files['file']
    if not file or not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type'}), 400
    ext = file.filename.rsplit('.', 1)[1].lower()
    filename = f"club_{club_id}_{int(time.time())}.{ext}"
    filepath = os.path.join(CLUB_IMAGE_FOLDER, filename)
    file.save(filepath)
    url = f"/uploads/clubs/{filename}"
    club_obj.image_url = url
    db.session.commit()
    return jsonify({'url': _abs_url(url)}), 200


@clubs.route('/<int:club_id>/join', methods=['POST'])
@jwt_required()
def join_club(club_id):
    user_id = int(get_jwt_identity())
    current_user = db.session.get(user,user_id)
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


@clubs.route('/<int:club_id>/leave', methods=['POST'])
@jwt_required()
def leave_club(club_id):
    user_id = int(get_jwt_identity())
    current_user = db.session.get(user,user_id)
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


@clubs.route('/<int:club_id>/mods/<int:target_user_id>', methods=['POST'])
@jwt_required()
def grant_mod(club_id, target_user_id):
    user_id = int(get_jwt_identity())
    club_obj = club.query.get_or_404(club_id)
    if club_obj.admin_id != user_id:
        return jsonify({'error': 'Only the admin can grant mod status'}), 403
    if target_user_id == user_id:
        return jsonify({'error': 'Admin is already the owner'}), 400
    target = user.query.get_or_404(target_user_id)
    if not club_obj.is_member(target):
        return jsonify({'error': 'User is not a member'}), 400
    mods = list(club_obj.mod_ids or [])
    if target_user_id not in mods:
        mods.append(target_user_id)
        club_obj.mod_ids = mods
    club_obj.helper_ids = [hid for hid in (club_obj.helper_ids or []) if hid != target_user_id]
    db.session.commit()
    return jsonify({'mod_ids': club_obj.mod_ids, 'helper_ids': club_obj.helper_ids}), 200


@clubs.route('/<int:club_id>/mods/<int:target_user_id>', methods=['DELETE'])
@jwt_required()
def revoke_mod(club_id, target_user_id):
    user_id = int(get_jwt_identity())
    club_obj = club.query.get_or_404(club_id)
    if club_obj.admin_id != user_id:
        return jsonify({'error': 'Only the admin can revoke mod status'}), 403
    mods = [mod_id for mod_id in (club_obj.mod_ids or []) if mod_id != target_user_id]
    club_obj.mod_ids = mods
    db.session.commit()
    return jsonify({'mod_ids': club_obj.mod_ids}), 200


@clubs.route('/<int:club_id>/helpers/<int:target_user_id>', methods=['POST'])
@jwt_required()
def grant_helper(club_id, target_user_id):
    user_id = int(get_jwt_identity())
    club_obj = club.query.get_or_404(club_id)
    if club_obj.admin_id != user_id:
        return jsonify({'error': 'Only the admin can grant helper status'}), 403
    if target_user_id == user_id:
        return jsonify({'error': 'Admin cannot assign roles to themselves'}), 400
    target = user.query.get_or_404(target_user_id)
    if not club_obj.is_member(target):
        return jsonify({'error': 'User is not a member'}), 400
    helpers = list(club_obj.helper_ids or [])
    if target_user_id not in helpers:
        helpers.append(target_user_id)
        club_obj.helper_ids = helpers
    mods = [mid for mid in (club_obj.mod_ids or []) if mid != target_user_id]
    club_obj.mod_ids = mods
    db.session.commit()
    return jsonify({'helper_ids': club_obj.helper_ids, 'mod_ids': club_obj.mod_ids}), 200


@clubs.route('/<int:club_id>/helpers/<int:target_user_id>', methods=['DELETE'])
@jwt_required()
def revoke_helper(club_id, target_user_id):
    user_id = int(get_jwt_identity())
    club_obj = club.query.get_or_404(club_id)
    current_user_obj = db.session.get(user, user_id)
    if club_obj.admin_id != user_id and not club_obj.is_mod(current_user_obj):
        return jsonify({'error': 'Only admin or mod can revoke helper status'}), 403
    club_obj.helper_ids = [hid for hid in (club_obj.helper_ids or []) if hid != target_user_id]
    db.session.commit()
    return jsonify({'helper_ids': club_obj.helper_ids}), 200


@clubs.route('/<int:club_id>/kick/<int:target_user_id>', methods=['POST'])
@jwt_required()
def kick_member(club_id, target_user_id):
    user_id = int(get_jwt_identity())
    club_obj = club.query.get_or_404(club_id)
    current_user_obj = db.session.get(user, user_id)
    if club_obj.admin_id != user_id and not club_obj.is_mod(current_user_obj):
        return jsonify({'error': 'Only admin or mod can kick members'}), 403
    target = user.query.get_or_404(target_user_id)
    if club_obj.is_mod(target) and club_obj.admin_id != user_id:
        return jsonify({'error': 'Only admin can kick a mod'}), 403
    if target_user_id == user_id:
        return jsonify({'error': 'Cannot kick yourself'}), 400
    if not club_obj.is_member(target):
        return jsonify({'error': 'User is not a member'}), 400
    club_obj.remove_member(target)
    club_obj.mod_ids = [mid for mid in (club_obj.mod_ids or []) if mid != target_user_id]
    club_obj.helper_ids = [hid for hid in (club_obj.helper_ids or []) if hid != target_user_id]
    db.session.commit()
    return jsonify({'message': f'Kicked {target.username}'}), 200


@clubs.route('/<int:club_id>/pin', methods=['POST'])
@jwt_required()
def pin_club(club_id):
    user_id = int(get_jwt_identity())
    current_user = db.session.get(user,user_id)
    club.query.get_or_404(club_id)

    pinned = list(current_user.pinned_club_ids or [])
    if club_id not in pinned:
        if len(pinned) >= 4:
            return jsonify({'error': 'Maximum of 4 pinned clubs allowed'}), 400
        current_user.pinned_club_ids = pinned + [club_id]
        db.session.commit()

    return jsonify({'message': 'Club pinned'}), 200


@clubs.route('/<int:club_id>/unpin', methods=['POST'])
@jwt_required()
def unpin_club(club_id):
    user_id = int(get_jwt_identity())
    current_user = db.session.get(user,user_id)

    pinned = list(current_user.pinned_club_ids or [])
    if club_id in pinned:
        current_user.pinned_club_ids = [pinned_id for pinned_id in pinned if pinned_id != club_id]
        db.session.commit()

    return jsonify({'message': 'Club unpinned'}), 200


@clubs.route('/pinned', methods=['GET'])
@jwt_required()
def get_pinned_clubs():
    user_id = int(get_jwt_identity())
    current_user = db.session.get(user,user_id)
    pinned_ids = current_user.pinned_club_ids or []
    pinned = club.query.filter(club.id.in_(pinned_ids)).all()
    return jsonify({'clubs': [pinned_club.to_dict() for pinned_club in pinned]}), 200


@clubs.route('/my-clubs-with-lists', methods=['GET'])
@jwt_required()
def get_my_clubs_with_lists():
    user_id = int(get_jwt_identity())
    current_user = db.session.get(user,user_id)

    clubs_data = []
    for club_item in current_user.clubs:
        club_data = club_item.to_dict()
        club_data['lists'] = [lst.to_dict(include_movies=True, include_shows=True) for lst in club_item.lists]
        clubs_data.append(club_data)

    return jsonify({'clubs': clubs_data}), 200
