from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, user, movie, movielist
from activity import log_event

movies = Blueprint('movies', __name__)


@movies.route('/add', methods=['POST'])
@jwt_required()
def add_movie():
    user_id = int(get_jwt_identity())
    current_user = db.session.get(user,user_id)

    data = request.get_json()
    movie_title = data.get('title')
    movie_poster = data.get('poster')
    movie_tmdb_id = data.get('tmdb_id')
    list_ids = data.get('list_ids', [])

    if not list_ids:
        return jsonify({'error': 'Select at least one list'}), 400

    existing = movie.query.filter_by(userID=user_id, tmdbID=movie_tmdb_id).first()
    if existing:
        new_movie = existing
    else:
        new_movie = movie(title=movie_title, posterURL=movie_poster, tmdbID=movie_tmdb_id, userID=user_id)
        db.session.add(new_movie)
        db.session.commit()

    added_to = []
    for list_id in list_ids:
        list_obj = db.session.get(movielist,list_id)
        if list_obj and list_obj.can_edit(current_user):
            if new_movie not in list_obj.movies:
                list_obj.movies.append(new_movie)
                added_to.append(list_obj)

    if added_to:
        db.session.commit()
        for list_obj in added_to:
            if list_obj.is_club_list():
                log_event(
                    event_type='user_in_club_added_movie',
                    user_id=user_id,
                    club_id=list_obj.club_id,
                    list_id=list_obj.id,
                    movie_id=new_movie.id,
                    description=f"Added '{movie_title}' to club list '{list_obj.name}'",
                    extra_data={'movie_title': movie_title, 'list_name': list_obj.name, 'club_name': list_obj.club.name}
                )
            else:
                log_event(
                    event_type='user_added_movie',
                    user_id=user_id,
                    list_id=list_obj.id,
                    movie_id=new_movie.id,
                    description=f"Added '{movie_title}' to list '{list_obj.name}'",
                    extra_data={'movie_title': movie_title, 'list_name': list_obj.name}
                )
        return jsonify({'message': f'Added {movie_title} to {", ".join([added_list.name for added_list in added_to])}'}), 200
    else:
        return jsonify({'message': f'{movie_title} is already in those lists'}), 200


@movies.route('/remove/<int:movie_id>', methods=['POST'])
@jwt_required()
def remove_movie(movie_id):
    user_id = int(get_jwt_identity())
    current_user = db.session.get(user,user_id)

    data = request.get_json()
    list_id = data.get('list_id')
    list_obj = movielist.query.get_or_404(list_id)

    if not list_obj.can_edit(current_user):
        return jsonify({'error': 'No permission to edit this list'}), 403

    movie_remove = movie.query.get_or_404(movie_id)

    if movie_remove in list_obj.movies:
        list_obj.movies.remove(movie_remove)
        db.session.commit()

        if list_obj.is_club_list():
            log_event(
                event_type='user_in_club_removed_movie',
                user_id=user_id,
                club_id=list_obj.club_id,
                list_id=list_obj.id,
                movie_id=movie_remove.id,
                description=f"Removed '{movie_remove.title}' from club list '{list_obj.name}'",
                extra_data={'movie_title': movie_remove.title, 'list_name': list_obj.name, 'club_name': list_obj.club.name}
            )
        else:
            log_event(
                event_type='user_removed_movie',
                user_id=user_id,
                list_id=list_obj.id,
                movie_id=movie_remove.id,
                description=f"Removed '{movie_remove.title}' from list '{list_obj.name}'",
                extra_data={'movie_title': movie_remove.title, 'list_name': list_obj.name}
            )

        if not movie_remove.lists:
            db.session.delete(movie_remove)
            db.session.commit()

        return jsonify({'message': f'Removed {movie_remove.title} from {list_obj.name}'}), 200
    else:
        return jsonify({'error': 'Movie not found in list'}), 404


@movies.route('/my-movies', methods=['GET'])
@jwt_required()
def get_my_movies():
    user_id = int(get_jwt_identity())
    user_lists = movielist.query.filter_by(userID=user_id).all()
    return jsonify({'lists': [lst.to_dict(include_movies=True, include_shows=True) for lst in user_lists]}), 200
