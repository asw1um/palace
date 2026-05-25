import os
import time
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename

from models import db, user as User, movielist
from activity import log_event

users_bp = Blueprint('users', __name__)

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'instance', 'uploads')
PROFILE_FOLDER = os.path.join(UPLOAD_FOLDER, 'profiles')
BANNER_FOLDER = os.path.join(UPLOAD_FOLDER, 'banners')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

os.makedirs(PROFILE_FOLDER, exist_ok=True)
os.makedirs(BANNER_FOLDER, exist_ok=True)


def _abs_url(path):
    if not path:
        return None
    if path.startswith('http'):
        return path
    host = request.host_url.rstrip('/')
    return f"{host}{path}"


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@users_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    user_id = int(get_jwt_identity())
    current_user = db.session.get(User,user_id)
    if not current_user:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json()
    nickname = data.get('nickname', '').strip()
    bio = data.get('bio', '').strip()

    if len(nickname) > 16:
        return jsonify({'error': 'Nickname must be 16 characters or fewer'}), 400
    if len(bio) > 500:
        return jsonify({'error': 'Bio must be 500 characters or fewer'}), 400

    if nickname is not None:
        current_user.nickname = nickname or None
    if bio is not None:
        current_user.bio = bio

    db.session.commit()
    data = current_user.to_dict()
    data['profile_picture'] = _abs_url(data.get('profile_picture'))
    data['banner'] = _abs_url(data.get('banner'))
    return jsonify(data), 200


@users_bp.route('/upload-picture', methods=['POST'])
@jwt_required()
def upload_profile_picture():
    user_id = int(get_jwt_identity())
    current_user = db.session.get(User,user_id)
    if not current_user:
        return jsonify({'error': 'User not found'}), 404

    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    if file and allowed_file(file.filename):
        ext = secure_filename(file.filename).rsplit('.', 1)[1].lower()
        filename = f"{user_id}_{int(time.time())}.{ext}"
        filepath = os.path.join(PROFILE_FOLDER, filename)
        file.save(filepath)

        if current_user.profile_picture:
            old_path = os.path.join(UPLOAD_FOLDER, current_user.profile_picture.replace('/uploads/', ''))
            if os.path.exists(old_path):
                os.remove(old_path)

        current_user.profile_picture = f"/uploads/profiles/{filename}"
        current_user.pfp_zoom = request.form.get('zoom', 1.0, type=float)
        current_user.pfp_pos_x = request.form.get('pos_x', 50, type=int)
        current_user.pfp_pos_y = request.form.get('pos_y', 50, type=int)
        db.session.commit()
        log_event(
            event_type='user_changed_pfp',
            user_id=current_user.id,
            description=f"{current_user.display_name} changed their profile picture"
        )
        return jsonify({'message': 'Profile picture updated', 'url': _abs_url(current_user.profile_picture)}), 200

    return jsonify({'error': 'Invalid file type'}), 400


@users_bp.route('/upload-banner', methods=['POST'])
@jwt_required()
def upload_banner():
    user_id = int(get_jwt_identity())
    current_user = db.session.get(User,user_id)
    if not current_user:
        return jsonify({'error': 'User not found'}), 404

    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    if file and allowed_file(file.filename):
        ext = secure_filename(file.filename).rsplit('.', 1)[1].lower()
        filename = f"{user_id}_{int(time.time())}.{ext}"
        filepath = os.path.join(BANNER_FOLDER, filename)
        file.save(filepath)

        if current_user.banner:
            old_path = os.path.join(UPLOAD_FOLDER, current_user.banner.replace('/uploads/', ''))
            if os.path.exists(old_path):
                os.remove(old_path)

        current_user.banner = f"/uploads/banners/{filename}"
        current_user.banner_zoom = request.form.get('zoom', 1.0, type=float)
        current_user.banner_pos_x = request.form.get('pos_x', 50, type=int)
        current_user.banner_pos_y = request.form.get('pos_y', 50, type=int)
        db.session.commit()
        log_event(
            event_type='user_changed_banner',
            user_id=current_user.id,
            description=f"{current_user.display_name} changed their banner"
        )
        return jsonify({'message': 'Banner updated', 'url': _abs_url(current_user.banner)}), 200

    return jsonify({'error': 'Invalid file type'}), 400


@users_bp.route('/users', methods=['GET'])
@jwt_required()
def get_users():
    users = User.query.all()
    return jsonify({
        'users': [
            {
                'id': found_user.id,
                'username': found_user.username,
                'nickname': found_user.nickname,
                'bio': found_user.bio or '',
                'profile_picture': _abs_url(found_user.profile_picture),
                'banner': _abs_url(found_user.banner),
                'created_at': found_user.created_at.isoformat() if found_user.created_at else None,
            }
            for found_user in users
        ]
    }), 200


@users_bp.route('/users/<string:username>', methods=['GET'])
@jwt_required()
def get_user_profile(username):
    target_user = User.query.filter_by(username=username).first()
    if not target_user:
        return jsonify({'error': 'User not found'}), 404

    user_lists = movielist.query.filter_by(user_id=target_user.id).all()
    user_clubs = target_user.clubs

    return jsonify({
        'user': {
            'id': target_user.id,
            'username': target_user.username,
            'nickname': target_user.nickname,
            'bio': target_user.bio or '',
            'profile_picture': _abs_url(target_user.profile_picture),
            'banner': _abs_url(target_user.banner),
            'banner_zoom': target_user.banner_zoom,
            'banner_pos_x': target_user.banner_pos_x,
            'banner_pos_y': target_user.banner_pos_y,
            'pfp_zoom': target_user.pfp_zoom,
            'pfp_pos_x': target_user.pfp_pos_x,
            'pfp_pos_y': target_user.pfp_pos_y,
            'created_at': target_user.created_at.isoformat() if target_user.created_at else None,
        },
        'lists': [user_list.to_dict(include_movies=True, include_shows=True) for user_list in user_lists],
        'clubs': [
            {
                'id': user_club.id,
                'name': user_club.name,
                'description': user_club.description,
                'member_count': len(user_club.members),
            }
            for user_club in user_clubs
        ],
    }), 200