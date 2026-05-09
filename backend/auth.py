import os
import time
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename

from dbstruct import db, user as User, movielist
from activity import log_event

auth = Blueprint('auth', __name__)


def _abs_url(path):
    if not path:
        return None
    if path.startswith('http'):
        return path
    host = request.host_url.rstrip('/')
    return f"{host}{path}"

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
PROFILE_FOLDER = os.path.join(UPLOAD_FOLDER, 'profiles')
BANNER_FOLDER = os.path.join(UPLOAD_FOLDER, 'banners')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

# ensure upload directories exist
os.makedirs(PROFILE_FOLDER, exist_ok=True)
os.makedirs(BANNER_FOLDER, exist_ok=True)


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@auth.route('/signup', methods=['POST'])
def signup():
    data = request.get_json()
    nickname = data.get('nickname', '').strip()

    if not nickname or len(nickname) < 1 or len(nickname) > 16:
        return jsonify({'error': 'Nickname must be 1-16 characters'}), 400
    
    if User.query.filter_by(nickname=nickname).first():
        return jsonify({'error': 'Nickname already exists'}), 409

    new_user = User(nickname=nickname)
    db.session.add(new_user)
    db.session.commit()

    # default lists for the user
    default1 = movielist(name="want to watch", userID=new_user.id)
    default2 = movielist(name="watched", userID=new_user.id)
    default3 = movielist(name="currently watching", userID=new_user.id)
    db.session.add(default1)
    db.session.add(default2)
    db.session.add(default3)
    db.session.commit()

    # fixes the login issue (fuck duran)
    log_event(
        event_type='new_user',
        user_id=new_user.id,
        description=f"{new_user.nickname} joined the forum"
    )

    access_token = create_access_token(identity=str(new_user.id))
    
    return jsonify({
        'message': 'Account created successfully',
        'user': {
            'id': new_user.id,
            'nickname': new_user.nickname
        },
        'access_token': access_token
    }), 201

# currently nick is required, will remove it later, just for test
@auth.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    nickname = data.get('nickname', '').strip()

    if not nickname:
        return jsonify({'error': 'Nickname is required'}), 400

    log_user = User.query.filter_by(nickname=nickname).first()

    if not log_user:
        return jsonify({'error': 'User not found'}), 404

    access_token = create_access_token(identity=str(log_user.id))
    
    return jsonify({
        'message': 'Login successful',
        'user': {
            'id': log_user.id,
            'nickname': log_user.nickname
        },
        'access_token': access_token
    }), 200


@auth.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    user_id = int(get_jwt_identity())
    current_user = User.query.get(user_id)
    
    if not current_user:
        return jsonify({'error': 'User not found'}), 404
    
    data = current_user.to_dict()
    data['profile_picture'] = _abs_url(data.get('profile_picture'))
    data['banner'] = _abs_url(data.get('banner'))
    return jsonify(data), 200


@auth.route('/upload-profile-picture', methods=['POST'])
@jwt_required()
def upload_profile_picture():
    user_id = int(get_jwt_identity())
    current_user = User.query.get(user_id)
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

        # delete old file if exists
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
            description=f"{current_user.nickname} changed their profile picture"
        )
        return jsonify({'message': 'Profile picture updated', 'url': _abs_url(current_user.profile_picture)}), 200

    return jsonify({'error': 'Invalid file type'}), 400


@auth.route('/upload-banner', methods=['POST'])
@jwt_required()
def upload_banner():
    user_id = int(get_jwt_identity())
    current_user = User.query.get(user_id)
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

        # delete old file if exists
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
            description=f"{current_user.nickname} changed their banner"
        )
        return jsonify({'message': 'Banner updated', 'url': _abs_url(current_user.banner)}), 200

    return jsonify({'error': 'Invalid file type'}), 400


@auth.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    # jwt is currently stateless, have to logout client side
    # cleanup can be used serverside
    return jsonify({'message': 'Logout successful'}), 200


@auth.route('/users', methods=['GET'])
@jwt_required()
def get_users():
    users = User.query.all()
    return jsonify({
        'users': [
            {
                'id': u.id,
                'nickname': u.nickname,
                'profile_picture': _abs_url(u.profile_picture),
                'banner': _abs_url(u.banner),
            }
            for u in users
        ]
    }), 200


@auth.route('/users/<int:user_id>', methods=['GET'])
@jwt_required()
def get_user_profile(user_id):
    target_user = User.query.get(user_id)
    if not target_user:
        return jsonify({'error': 'User not found'}), 404

    from dbstruct import movielist, club
    user_lists = movielist.query.filter_by(userID=user_id).all()
    user_clubs = target_user.clubs

    return jsonify({
        'user': {
            'id': target_user.id,
            'nickname': target_user.nickname,
            'profile_picture': _abs_url(target_user.profile_picture),
            'banner': _abs_url(target_user.banner),
            'banner_zoom': target_user.banner_zoom,
            'banner_pos_x': target_user.banner_pos_x,
            'banner_pos_y': target_user.banner_pos_y,
            'pfp_zoom': target_user.pfp_zoom,
            'pfp_pos_x': target_user.pfp_pos_x,
            'pfp_pos_y': target_user.pfp_pos_y,
        },
        'lists': [
            {
                'id': l.id,
                'name': l.name,
                'movie_count': len(l.movies),
                'show_count': len(l.shows),
            }
            for l in user_lists
        ],
        'clubs': [
            {
                'id': c.id,
                'name': c.name,
                'description': c.description,
                'member_count': len(c.members),
            }
            for c in user_clubs
        ],
    }), 200
