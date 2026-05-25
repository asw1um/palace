from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from models import db, CustomMedia

custom_media_bp = Blueprint('custom_media', __name__)


@custom_media_bp.route('/<string:media_type>/<int:tmdb_id>', methods=['GET'])
@jwt_required()
def get_meta(media_type, tmdb_id):
    if media_type not in ('movie', 'tv'):
        return jsonify({'error': 'Invalid media type'}), 400
    user_id = int(get_jwt_identity())
    row = CustomMedia.query.filter_by(user_id=user_id, tmdb_id=tmdb_id, media_type=media_type).first()
    if not row:
        return jsonify(None), 200
    return jsonify(row.to_dict()), 200


@custom_media_bp.route('/<string:media_type>/<int:tmdb_id>', methods=['PUT'])
@jwt_required()
def set_meta(media_type, tmdb_id):
    if media_type not in ('movie', 'tv'):
        return jsonify({'error': 'Invalid media type'}), 400
    user_id = int(get_jwt_identity())
    data = request.get_json()

    row = CustomMedia.query.filter_by(user_id=user_id, tmdb_id=tmdb_id, media_type=media_type).first()
    if row is None:
        row = CustomMedia(user_id=user_id, tmdb_id=tmdb_id, media_type=media_type)
        db.session.add(row)

    if media_type == 'movie' and 'runtime' in data:
        runtime = int(data['runtime'])
        if runtime <= 0:
            return jsonify({'error': 'Runtime must be greater than 0'}), 400
        row.runtime = runtime

    if media_type == 'tv' and 'seasons' in data:
        seasons = data['seasons']
        if not isinstance(seasons, list) or len(seasons) == 0:
            return jsonify({'error': 'seasons must be a non-empty list'}), 400
        for s in seasons:
            if not isinstance(s.get('season_number'), int) or not isinstance(s.get('episode_count'), int):
                return jsonify({'error': 'Each season needs season_number and episode_count as integers'}), 400
        row.seasons = seasons

    db.session.commit()
    return jsonify(row.to_dict()), 200
