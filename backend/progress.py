from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from models import db, ShowProgress, MovieProgress

progress_bp = Blueprint('watchlist', __name__)


@progress_bp.route('/progress/<int:show_id>', methods=['GET'])
@jwt_required()
def get_progress(show_id):
    user_id = int(get_jwt_identity())
    progress = ShowProgress.query.filter_by(user_id=user_id, show_id=show_id).all()
    return jsonify({'progress': [p.to_dict() for p in progress]}), 200


@progress_bp.route('/progress', methods=['POST'])
@jwt_required()
def update_progress():
    user_id = int(get_jwt_identity())
    data = request.get_json()
    show_id = data.get('show_id')
    season_number = data.get('season_number')
    episode_number = data.get('episode_number')
    watched = data.get('watched')

    if show_id is None or season_number is None or episode_number is None:
        return jsonify({'error': 'show_id, season_number, and episode_number are required'}), 400

    prog = ShowProgress.query.filter_by(
        user_id=user_id,
        show_id=show_id,
        season_number=season_number,
        episode_number=episode_number
    ).first()

    if prog:
        prog.watched = bool(watched)
    else:
        prog = ShowProgress(
            user_id=user_id,
            show_id=show_id,
            season_number=season_number,
            episode_number=episode_number,
            watched=bool(watched)
        )
        db.session.add(prog)

    db.session.commit()
    return jsonify(prog.to_dict()), 200


@progress_bp.route('/all-progress', methods=['GET'])
@jwt_required()
def get_all_progress():
    user_id = int(get_jwt_identity())

    show_progress = ShowProgress.query.filter_by(user_id=user_id).all()
    shows_map: dict[int, dict[str, bool]] = {}
    for p in show_progress:
        if p.show_id not in shows_map:
            shows_map[p.show_id] = {}
        shows_map[p.show_id][f"{p.season_number}-{p.episode_number}"] = p.watched

    movie_progress = MovieProgress.query.filter_by(user_id=user_id).all()
    movies_map = {p.movie_id: p.to_dict() for p in movie_progress}

    return jsonify({'shows': shows_map, 'movies': movies_map}), 200


@progress_bp.route('/movie-progress/<int:movie_id>', methods=['GET'])
@jwt_required()
def get_movie_progress(movie_id):
    user_id = int(get_jwt_identity())
    prog = MovieProgress.query.filter_by(user_id=user_id, movie_id=movie_id).first()
    return jsonify(prog.to_dict() if prog else {'watched_minutes': 0, 'total_minutes': 0}), 200


@progress_bp.route('/movie-progress', methods=['POST'])
@jwt_required()
def update_movie_progress():
    user_id = int(get_jwt_identity())
    data = request.get_json()
    movie_id = data.get('movie_id')
    watched_minutes = data.get('watched_minutes', 0)
    total_minutes = data.get('total_minutes', 0)

    if movie_id is None:
        return jsonify({'error': 'movie_id is required'}), 400

    prog = MovieProgress.query.filter_by(user_id=user_id, movie_id=movie_id).first()
    if prog:
        prog.watched_minutes = int(watched_minutes)
        prog.total_minutes = int(total_minutes)
    else:
        prog = MovieProgress(
            user_id=user_id,
            movie_id=int(movie_id),
            watched_minutes=int(watched_minutes),
            total_minutes=int(total_minutes)
        )
        db.session.add(prog)

    db.session.commit()
    return jsonify(prog.to_dict()), 200
