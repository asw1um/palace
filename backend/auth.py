from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity

from dbstruct import db, user as User, movielist
from activity import log_event

auth = Blueprint('auth', __name__)


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
    db.session.add(default1)
    db.session.add(default2)
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
    
    return jsonify({
        'id': current_user.id,
        'nickname': current_user.nickname
    }), 200


@auth.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    # jwt is currently stateless, have to logout client side
    # cleanup can be used serverside
    return jsonify({'message': 'Logout successful'}), 200
