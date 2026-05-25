import uuid
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from models import db, user as User, movielist
from activity import log_event

auth = Blueprint('auth', __name__)


def _abs_url(path):
    if not path:
        return None
    if path.startswith('http'):
        return path
    host = request.host_url.rstrip('/')
    return f"{host}{path}"


@auth.route('/register', methods=['POST'])
@auth.route('/signup', methods=['POST'])
def signup():
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '')
    nickname = data.get('nickname', '').strip() or None

    if not username or len(username) < 1 or len(username) > 32:
        return jsonify({'error': 'Username must be 1-32 characters'}), 400

    if not password or len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username already exists'}), 409

    new_user = User(
        username=username,
        password_hash=generate_password_hash(password),
        nickname=nickname
    )
    db.session.add(new_user)
    db.session.commit()

    default1 = movielist(name="want to watch", userID=new_user.id)
    default2 = movielist(name="watched", userID=new_user.id)
    default3 = movielist(name="currently watching", userID=new_user.id)
    db.session.add(default1)
    db.session.add(default2)
    db.session.add(default3)
    db.session.commit()

    log_event(
        event_type='new_user',
        user_id=new_user.id,
        description=f"{new_user.display_name} joined the forum"
    )

    access_token = create_access_token(
        identity=str(new_user.id),
        additional_claims={'st': new_user.session_token}
    )
    user_data = new_user.to_dict()
    user_data['profile_picture'] = _abs_url(user_data.get('profile_picture'))
    user_data['banner'] = _abs_url(user_data.get('banner'))

    return jsonify({'message': 'Account created successfully', 'user': user_data, 'access_token': access_token}), 201


@auth.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not username:
        return jsonify({'error': 'Username is required'}), 400
    if not password:
        return jsonify({'error': 'Password is required'}), 400

    log_user = User.query.filter_by(username=username).first()
    if not log_user or not check_password_hash(log_user.password_hash, password):
        return jsonify({'error': 'Invalid username or password'}), 401

    access_token = create_access_token(
        identity=str(log_user.id),
        additional_claims={'st': log_user.session_token}
    )
    user_data = log_user.to_dict()
    user_data['profile_picture'] = _abs_url(user_data.get('profile_picture'))
    user_data['banner'] = _abs_url(user_data.get('banner'))

    return jsonify({'message': 'Login successful', 'user': user_data, 'access_token': access_token}), 200


@auth.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    user_id = int(get_jwt_identity())
    current_user = db.session.get(User,user_id)
    if not current_user:
        return jsonify({'error': 'User not found'}), 404

    data = current_user.to_dict()
    data['profile_picture'] = _abs_url(data.get('profile_picture'))
    data['banner'] = _abs_url(data.get('banner'))
    return jsonify(data), 200


@auth.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    user_id = int(get_jwt_identity())
    current_user = db.session.get(User,user_id)
    if current_user:
        current_user.session_token = str(uuid.uuid4())
        db.session.commit()
    return jsonify({'message': 'Logout successful'}), 200
