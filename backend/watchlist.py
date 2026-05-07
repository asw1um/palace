from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from dbstruct import db, user, movie, show, show_season, movielist
from search import getShow as fetchShowDetails
from activity import log_event

movies = Blueprint('movies', __name__)

# --- movies ---

@movies.route('/add', methods=['POST'])
@jwt_required()
def add_movie():
    user_id = int(get_jwt_identity())
    current_user = user.query.get(user_id)

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
        new_movie = movie(
            title=movie_title,
            posterURL=movie_poster,
            tmdbID=movie_tmdb_id,
            userID=user_id
        )
        db.session.add(new_movie)
        db.session.commit()

    added_to = []
    for list_id in list_ids:
        list_obj = movielist.query.get(list_id)
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
        return jsonify({'message': f'Added {movie_title} to {", ".join([l.name for l in added_to])}'}), 200
    else:
        return jsonify({'message': f'{movie_title} is already in those lists'}), 200


@movies.route('/remove/<int:movie_id>', methods=['POST'])
@jwt_required()
def remove_movie(movie_id):
    user_id = int(get_jwt_identity())
    current_user = user.query.get(user_id)

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

    return jsonify({
        'lists': [lst.to_dict(include_movies=True, include_shows=True) for lst in user_lists]
    }), 200


# --- shows ---

@movies.route('/shows/add', methods=['POST'])
@jwt_required()
def add_show():
    user_id = int(get_jwt_identity())
    current_user = user.query.get(user_id)

    data = request.get_json()
    show_title = data.get('title')
    show_poster = data.get('poster')
    show_tmdb_id = data.get('tmdb_id')
    list_ids = data.get('list_ids', [])

    if not list_ids:
        return jsonify({'error': 'Select at least one list'}), 400

    existing = show.query.filter_by(userID=user_id, tmdbID=show_tmdb_id).first()

    if existing:
        new_show = existing
    else:
        new_show = show(
            title=show_title,
            posterURL=show_poster,
            tmdbID=show_tmdb_id,
            userID=user_id
        )
        db.session.add(new_show)
        db.session.flush()

        show_details = fetchShowDetails(show_tmdb_id)
        if show_details:
            new_show.total_seasons = show_details.get('number_of_seasons') or 0
            for s in show_details.get('seasons', []):
                db.session.add(show_season(
                    show_id=new_show.id,
                    season_number=s['season_number'],
                    episode_count=s['episode_count']
                ))

        db.session.commit()

    added_to = []
    for list_id in list_ids:
        list_obj = movielist.query.get(list_id)
        if list_obj and list_obj.can_edit(current_user):
            if new_show not in list_obj.shows:
                list_obj.shows.append(new_show)
                added_to.append(list_obj)

    if added_to:
        db.session.commit()
        for list_obj in added_to:
            if list_obj.is_club_list():
                log_event(
                    event_type='user_in_club_added_show',
                    user_id=user_id,
                    club_id=list_obj.club_id,
                    list_id=list_obj.id,
                    show_id=new_show.id,
                    description=f"Added '{show_title}' to club list '{list_obj.name}'",
                    extra_data={'show_title': show_title, 'list_name': list_obj.name, 'club_name': list_obj.club.name}
                )
            else:
                log_event(
                    event_type='user_added_show',
                    user_id=user_id,
                    list_id=list_obj.id,
                    show_id=new_show.id,
                    description=f"Added '{show_title}' to list '{list_obj.name}'",
                    extra_data={'show_title': show_title, 'list_name': list_obj.name}
                )
        return jsonify({'message': f'Added {show_title} to {", ".join([l.name for l in added_to])}'}), 200
    else:
        return jsonify({'message': f'{show_title} is already in those lists'}), 200


@movies.route('/shows/remove/<int:show_id>', methods=['POST'])
@jwt_required()
def remove_show(show_id):
    user_id = int(get_jwt_identity())
    current_user = user.query.get(user_id)

    data = request.get_json()
    list_id = data.get('list_id')

    list_obj = movielist.query.get_or_404(list_id)

    if not list_obj.can_edit(current_user):
        return jsonify({'error': 'No permission to edit this list'}), 403

    show_obj = show.query.get_or_404(show_id)

    if show_obj in list_obj.shows:
        list_obj.shows.remove(show_obj)
        db.session.commit()

        if list_obj.is_club_list():
            log_event(
                event_type='user_in_club_removed_show',
                user_id=user_id,
                club_id=list_obj.club_id,
                list_id=list_obj.id,
                show_id=show_obj.id,
                description=f"Removed '{show_obj.title}' from club list '{list_obj.name}'",
                extra_data={'show_title': show_obj.title, 'list_name': list_obj.name, 'club_name': list_obj.club.name}
            )
        else:
            log_event(
                event_type='user_removed_show',
                user_id=user_id,
                list_id=list_obj.id,
                show_id=show_obj.id,
                description=f"Removed '{show_obj.title}' from list '{list_obj.name}'",
                extra_data={'show_title': show_obj.title, 'list_name': list_obj.name}
            )

        if not show_obj.show_lists:
            db.session.delete(show_obj)
            db.session.commit()

        return jsonify({'message': f'Removed {show_obj.title} from {list_obj.name}'}), 200
    else:
        return jsonify({'error': 'Show not found in list'}), 404


@movies.route('/shows/update-progress/<int:show_id>', methods=['POST'])
@jwt_required()
def update_show_progress(show_id):
    user_id = int(get_jwt_identity())

    data = request.get_json()
    current_season = data.get('season')
    current_episode = data.get('episode')

    show_obj = show.query.filter_by(id=show_id, userID=user_id).first_or_404()
    show_obj.current_season = current_season
    show_obj.current_episode = current_episode
    db.session.commit()

    return jsonify({
        'message': f'Progress updated for {show_obj.title}',
        'show': show_obj.to_dict(include_seasons=True)
    }), 200


@movies.route('/shows/my-shows', methods=['GET'])
@jwt_required()
def get_my_shows():
    user_id = int(get_jwt_identity())
    user_shows = show.query.filter_by(userID=user_id).all()

    return jsonify({
        'shows': [s.to_dict(include_seasons=True) for s in user_shows]
    }), 200


@movies.route('/shows/<int:show_id>', methods=['GET'])
@jwt_required()
def get_show(show_id):
    user_id = int(get_jwt_identity())
    show_obj = show.query.filter_by(id=show_id, userID=user_id).first_or_404()

    return jsonify(show_obj.to_dict(include_seasons=True)), 200


@movies.route('/watching', methods=['GET'])
@jwt_required()
def get_watching():
    user_id = int(get_jwt_identity())
    user_shows = show.query.filter_by(userID=user_id).filter(show.current_season != None).all()

    watching = []
    for s in user_shows:
        if s.current_season > s.total_seasons:
            continue
        last_season = show_season.query.filter_by(show_id=s.id, season_number=s.total_seasons).first()
        last_ep = last_season.episode_count if last_season else 0
        if s.current_season == s.total_seasons and s.current_episode > last_ep:
            continue
        watching.append(s)

    return jsonify({'shows': [s.to_dict(include_seasons=True) for s in watching]}), 200