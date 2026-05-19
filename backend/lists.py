from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from dbstruct import db, movielist, user
from activity import log_event

lists = Blueprint('lists', __name__)

# fetch user lists
@lists.route('/', methods=['GET'])
@jwt_required()
def get_user_lists():
    user_id = int(get_jwt_identity())
    user_lists = movielist.query.filter_by(userID=user_id).all()
    
    return jsonify({
        'lists': [lst.to_dict() for lst in user_lists]
    }), 200

# NEW ENDPOINT: fetch user lists with movies and shows included
# Needed by the My Lists page to show list contents and dropdowns
# without making N+1 API calls for each list.
@lists.route('/with-movies', methods=['GET'])
@jwt_required()
def get_user_lists_with_movies():
    user_id = int(get_jwt_identity())
    user_lists = movielist.query.filter_by(userID=user_id).all()
    
    return jsonify({
        'lists': [lst.to_dict(include_movies=True, include_shows=True) for lst in user_lists]
    }), 200

# create user list
@lists.route('/', methods=['POST'])
@jwt_required()
def create_list():
    user_id = int(get_jwt_identity())
    data = request.get_json()
    list_name = data.get('name', '').strip()
    
    if not list_name:
        return jsonify({'error': 'List name cannot be empty'}), 400
    
    current_user = user.query.get(user_id)
    new_list = movielist(name=list_name, userID=user_id)
    db.session.add(new_list)
    db.session.commit()

    log_event(
        event_type='user_created_list',
        user_id=user_id,
        list_id=new_list.id,
        description=f"{current_user.display_name} created list: {list_name}",
        extra_data={'list_name': list_name}
    )
    
    return jsonify({
        'message': f'Created list: {list_name}',
        'list': new_list.to_dict()
    }), 201

# delete user list
@lists.route('/<int:list_id>', methods=['DELETE'])
@jwt_required()
def delete_list(list_id):
    user_id = int(get_jwt_identity())
    list_obj = movielist.query.get_or_404(list_id)

    if list_obj.userID != user_id:
        return jsonify({'error': 'Not your list'}), 403

    log_event(
        event_type='user_deleted_list',
        user_id=user_id,
        list_id=list_obj.id,
        description=f"Deleted list: {list_obj.name}",
        extra_data={'list_name': list_obj.name}
    )

    db.session.delete(list_obj)
    db.session.commit()
    return jsonify({'message': 'list deleted'}), 200

# get specific lists
@lists.route('/<int:list_id>', methods=['GET'])
@jwt_required()
def get_list(list_id):
    user_id = int(get_jwt_identity())
    current_user = user.query.get(user_id)
    list_obj = movielist.query.get_or_404(list_id)
    
    # visibility check
    if list_obj.is_personal_list() and list_obj.userID != user_id:
        return jsonify({'error': 'You do not have permission to view this list'}), 403
    
    if list_obj.is_club_list():
        if not list_obj.club.is_member(current_user):
            return jsonify({'error': 'You must be a club member to view this list'}), 403
    
    return jsonify({
        'list': list_obj.to_dict(include_movies=True)
    }), 200

# rename user list
@lists.route('/<int:list_id>/rename', methods=['PUT', 'POST'])
@jwt_required()
def rename_list(list_id):
    user_id = int(get_jwt_identity())
    list_obj = movielist.query.get_or_404(list_id)
    
    if list_obj.userID != user_id:
        return jsonify({'error': 'Not your list'}), 403
    
    data = request.get_json()
    new_name = data.get('name', '').strip()
    if not new_name:
        return jsonify({'error': 'Name cannot be empty'}), 400
    
    old_name = list_obj.name
    list_obj.name = new_name
    db.session.commit()

    log_event(
        event_type='user_renamed_list',
        user_id=user_id,
        list_id=list_obj.id,
        description=f"Renamed list from '{old_name}' to '{new_name}'",
        extra_data={'old_name': old_name, 'new_name': new_name}
    )
    
    return jsonify({
        'message': f'Renamed list to: {new_name}',
        'list': list_obj.to_dict()
    }), 200

# pin list
@lists.route('/<int:list_id>/pin', methods=['POST'])
@jwt_required()
def pin_list(list_id):
    user_id = int(get_jwt_identity())
    current_user = user.query.get(user_id)
    list_obj = movielist.query.get_or_404(list_id)
    
    if list_obj.is_personal_list() and list_obj.userID != user_id:
        return jsonify({'error': 'Not your list'}), 403
    if list_obj.is_club_list() and not list_obj.club.is_member(current_user):
        return jsonify({'error': 'Must be a club member'}), 403
    
    pinned = list(current_user.pinned_list_ids or [])
    if list_id not in pinned:
        if len(pinned) >= 4:
            return jsonify({'error': 'Maximum of 4 pinned lists allowed'}), 400
        current_user.pinned_list_ids = pinned + [list_id]
        db.session.commit()

    return jsonify({'message': 'List pinned'}), 200

# unpin list
@lists.route('/<int:list_id>/unpin', methods=['POST'])
@jwt_required()
def unpin_list(list_id):
    user_id = int(get_jwt_identity())
    current_user = user.query.get(user_id)
    
    pinned = list(current_user.pinned_list_ids or [])
    if list_id in pinned:
        current_user.pinned_list_ids = [x for x in pinned if x != list_id]
        db.session.commit()

    return jsonify({'message': 'List unpinned'}), 200

# get pinned lists
@lists.route('/pinned', methods=['GET'])
@jwt_required()
def get_pinned_lists():
    user_id = int(get_jwt_identity())
    current_user = user.query.get(user_id)
    pinned_ids = current_user.pinned_list_ids or []
    
    pinned = movielist.query.filter(movielist.id.in_(pinned_ids)).all()
    return jsonify({'lists': [l.to_dict(include_movies=True, include_shows=True) for l in pinned]}), 200


@lists.route('/<int:list_id>/add', methods=['POST'])
@jwt_required()
def add_movie_to_list(list_id):
    user_id = int(get_jwt_identity())
    current_user = user.query.get(user_id)
    list_obj = movielist.query.get_or_404(list_id)

    if not list_obj.can_edit(current_user):
        return jsonify({'error': 'No permission to edit this list'}), 403

    data = request.get_json()
    movie_data = data.get('movie')
    if not movie_data:
        return jsonify({'error': 'Movie object is required'}), 400

    from dbstruct import movie as MovieModel, show as ShowModel

    tmdb_id = movie_data.get('tmdb_id') or movie_data.get('id')
    title = movie_data.get('title')
    poster_url = movie_data.get('poster_url') or movie_data.get('poster')
    media_type = movie_data.get('media_type', 'movie')

    if media_type == 'tv':
        existing = ShowModel.query.filter_by(userID=user_id, tmdbID=tmdb_id).first()
        if existing:
            show_obj = existing
        else:
            show_obj = ShowModel(title=title, posterURL=poster_url, tmdbID=tmdb_id, userID=user_id)
            db.session.add(show_obj)
            db.session.commit()
        if show_obj not in list_obj.shows:
            list_obj.shows.append(show_obj)
            db.session.commit()
        return jsonify({'message': 'Show added to list', 'list': list_obj.to_dict(include_movies=True, include_shows=True)}), 200
    else:
        existing = MovieModel.query.filter_by(userID=user_id, tmdbID=tmdb_id).first()
        if existing:
            movie_obj = existing
        else:
            movie_obj = MovieModel(title=title, posterURL=poster_url, tmdbID=tmdb_id, userID=user_id)
            db.session.add(movie_obj)
            db.session.commit()
        if movie_obj not in list_obj.movies:
            list_obj.movies.append(movie_obj)
            db.session.commit()
        return jsonify({'message': 'Movie added to list', 'list': list_obj.to_dict(include_movies=True, include_shows=True)}), 200


@lists.route('/<int:list_id>/remove/<int:movie_id>', methods=['DELETE'])
@jwt_required()
def remove_movie_from_list(list_id, movie_id):
    user_id = int(get_jwt_identity())
    current_user = user.query.get(user_id)
    list_obj = movielist.query.get_or_404(list_id)

    if not list_obj.can_edit(current_user):
        return jsonify({'error': 'No permission to edit this list'}), 403

    from dbstruct import movie as MovieModel, show as ShowModel

    # Try movie first, then show
    movie_obj = MovieModel.query.get(movie_id)
    if movie_obj and movie_obj in list_obj.movies:
        list_obj.movies.remove(movie_obj)
        db.session.commit()
        if not movie_obj.lists:
            db.session.delete(movie_obj)
            db.session.commit()
        return jsonify({'message': 'Movie removed from list'}), 200

    show_obj = ShowModel.query.get(movie_id)
    if show_obj and show_obj in list_obj.shows:
        list_obj.shows.remove(show_obj)
        db.session.commit()
        return jsonify({'message': 'Show removed from list'}), 200

    return jsonify({'error': 'Item not found in list'}), 404
