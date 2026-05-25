from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from models import db, ShowProgress, MovieProgress

show_progress_bp = Blueprint('watchlist', __name__)


@show_progress_bp.route('/show_progress/<int:show_id>', methods=['GET'])
@jwt_required()
def get_show_progress(show_id):
    user_id = int(get_jwt_identity())
    show_progress = ShowProgress.query.filter_by(user_id=user_id, show_id=show_id).all()
    return jsonify({'show_progress': [entry.to_dict() for entry in show_progress]}), 200


@show_progress_bp.route('/show_progress', methods=['POST'])
@jwt_required()
def update_show_progress():
    user_id = int(get_jwt_identity())
    data = request.get_json()
    show_id = data.get('show_id')
    season_number = data.get('season_number')
    episode_number = data.get('episode_number')
    watched = data.get('watched')

    if show_id is None or season_number is None or episode_number is None:
        return jsonify({'error': 'show_id, season_number, and episode_number are required'}), 400

    show_prog = ShowProgress.query.filter_by(
        user_id=user_id,
        show_id=show_id,
        season_number=season_number,
        episode_number=episode_number
    ).first()

    if show_prog:
        show_prog.watched = bool(watched)
    else:
        show_prog = ShowProgress(
            user_id=user_id,
            show_id=show_id,
            season_number=season_number,
            episode_number=episode_number,
            watched=bool(watched)
        )
        db.session.add(show_prog)

    db.session.commit()
    return jsonify(show_prog.to_dict()), 200


@show_progress_bp.route('/all-show_progress', methods=['GET'])
@jwt_required()
def get_all_show_progress():
    user_id = int(get_jwt_identity())

    show_show_progress = ShowProgress.query.filter_by(user_id=user_id).all()
    shows_map: dict[int, dict[str, bool]] = {}
    for entry in show_show_progress:
        if entry.show_id not in shows_map:
            shows_map[entry.show_id] = {}
        shows_map[entry.show_id][f"{entry.season_number}-{entry.episode_number}"] = entry.watched

    movie_show_progress = MovieProgress.query.filter_by(user_id=user_id).all()
    movies_map = {entry.movie_id: entry.to_dict() for entry in movie_show_progress}

    return jsonify({'shows': shows_map, 'movies': movies_map}), 200


@show_progress_bp.route('/movie-show_progress/<int:movie_id>', methods=['GET'])
@jwt_required()
def get_movie_show_progress(movie_id):
    user_id = int(get_jwt_identity())
    show_prog = MovieProgress.query.filter_by(user_id=user_id, movie_id=movie_id).first()
    return jsonify(show_prog.to_dict() if show_prog else {'watched_minutes': 0, 'total_minutes': 0}), 200


@show_progress_bp.route('/movie-show_progress', methods=['POST'])
@jwt_required()
def update_movie_show_progress():
    user_id = int(get_jwt_identity())
    data = request.get_json()
    movie_id = data.get('movie_id')
    watched_minutes = data.get('watched_minutes', 0)
    total_minutes = data.get('total_minutes', 0)

    if movie_id is None:
        return jsonify({'error': 'movie_id is required'}), 400

    show_prog = MovieProgress.query.filter_by(user_id=user_id, movie_id=movie_id).first()
    if show_prog:
        show_prog.watched_minutes = int(watched_minutes)
        show_prog.total_minutes = int(total_minutes)
    else:
        show_prog = MovieProgress(
            user_id=user_id,
            movie_id=int(movie_id),
            watched_minutes=int(watched_minutes),
            total_minutes=int(total_minutes)
        )
        db.session.add(show_prog)

    db.session.commit()
    return jsonify(show_prog.to_dict()), 200
