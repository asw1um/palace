from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from dbstruct import db, Review, user
from activity import log_event

reviews = Blueprint('reviews', __name__)


def _abs_url(path):
    if not path:
        return None
    if path.startswith('http'):
        return path
    from flask import request as req
    host = req.host_url.rstrip('/')
    return f"{host}{path}"


def _enrich(review):
    d = review.to_dict(include_author=True)
    if d.get('author'):
        d['author']['profile_picture'] = _abs_url(d['author'].get('profile_picture'))
    return d


# upsert a review (create or update)
@reviews.route('/', methods=['POST'])
@jwt_required()
def upsert_review():
    user_id = int(get_jwt_identity())
    data = request.get_json()
    tmdb_id = data.get('tmdb_id')
    media_type = data.get('media_type')
    if not tmdb_id or not media_type:
        return jsonify({'error': 'tmdb_id and media_type required'}), 400

    existing = Review.query.filter_by(user_id=user_id, tmdb_id=tmdb_id, media_type=media_type).first()
    if existing:
        if 'rating' in data:
            existing.rating = data['rating']
        if 'content' in data:
            existing.content = data['content']
        if 'title' in data:
            existing.title = data['title']
        if 'poster_url' in data:
            existing.poster_url = data['poster_url']
        db.session.commit()
        current_user = user.query.get(user_id)
        log_event(
            event_type='user_updated_review',
            user_id=user_id,
            description=f"{current_user.display_name} updated their review of {existing.title}",
        )
        return jsonify({'review': _enrich(existing)}), 200
    else:
        review = Review(
            user_id=user_id,
            tmdb_id=tmdb_id,
            media_type=media_type,
            title=data.get('title', ''),
            poster_url=data.get('poster_url', ''),
            rating=data.get('rating'),
            content=data.get('content', ''),
        )
        db.session.add(review)
        db.session.commit()
        current_user = user.query.get(user_id)
        log_event(
            event_type='user_reviewed',
            user_id=user_id,
            description=f"{current_user.display_name} reviewed {review.title}",
        )
        return jsonify({'review': _enrich(review)}), 201


# delete a review
@reviews.route('/<int:review_id>', methods=['DELETE'])
@jwt_required()
def delete_review(review_id):
    user_id = int(get_jwt_identity())
    review = Review.query.get_or_404(review_id)
    if review.user_id != user_id:
        return jsonify({'error': 'Not your review'}), 403
    db.session.delete(review)
    db.session.commit()
    return jsonify({'message': 'Deleted'}), 200


# get all reviews for a title
@reviews.route('/title/<int:tmdb_id>/<media_type>', methods=['GET'])
@jwt_required()
def get_title_reviews(tmdb_id, media_type):
    revs = Review.query.filter_by(tmdb_id=tmdb_id, media_type=media_type)\
        .order_by(Review.created_at.desc()).all()
    return jsonify({'reviews': [_enrich(r) for r in revs]}), 200


# get current user's review for a specific title
@reviews.route('/me/<int:tmdb_id>/<media_type>', methods=['GET'])
@jwt_required()
def get_my_review(tmdb_id, media_type):
    user_id = int(get_jwt_identity())
    review = Review.query.filter_by(user_id=user_id, tmdb_id=tmdb_id, media_type=media_type).first()
    if not review:
        return jsonify({'review': None}), 200
    return jsonify({'review': _enrich(review)}), 200


# get all reviews by a user
@reviews.route('/user/<int:target_user_id>', methods=['GET'])
@jwt_required()
def get_user_reviews(target_user_id):
    revs = Review.query.filter_by(user_id=target_user_id)\
        .order_by(Review.created_at.desc()).all()
    return jsonify({'reviews': [_enrich(r) for r in revs]}), 200
