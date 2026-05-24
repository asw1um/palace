from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Review, user, ReviewReaction
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


def _enrich(review, current_user_id = None):
    review_data = review.to_dict(include_author=True)
    if review_data.get('author'):
        review_data['author']['profile_picture'] = _abs_url(review_data['author'].get('profile_picture'))
    likes_count = ReviewReaction.query.filter_by(reviewID=review.id, isLike=True).count()
    dislikes_count = ReviewReaction.query.filter_by(reviewID=review.id, isLike=False).count()

    my_reaction = None
    if current_user_id:
        user_react = ReviewReaction.query.filter_by(reviewID=review.id, userID=current_user_id).first()
        if user_react:
            my_reaction = 'like' if user_react.isLike else 'dislike'

    review_data['reactions'] = {
        'likes': likes_count,
        'dislikes': dislikes_count,
        'my_reaction': my_reaction
    }
    return review_data


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
        current_user = db.session.get(user,user_id)
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
        current_user = db.session.get(user,user_id)
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
    user_id = int(get_jwt_identity())
    revs = Review.query.filter_by(user_id=target_user_id)\
        .order_by(Review.created_at.desc()).all()
    return jsonify({'reviews': [_enrich(r, current_user_id=user_id) for r in revs]}), 200

# like and dislike in review
@reviews.route('/<int:review_id>/react', methods = ['POST'])
@jwt_required()
def react_to_review(review_id):
    target_review = Review.query.get_or_404(review_id)
    user_id = int(get_jwt_identity())
    current_user = db.session.get(user,user_id)
    
    data = request.get_json() or {}
    reaction_type = data.get('reaction')

    if reaction_type not in ['like', 'dislike']:
        return jsonify({'error': "reaction must be like or dislike"}), 400

    target_is_like = (reaction_type == 'like')
    existing = ReviewReaction.query.filter_by(userID=user_id, reviewID=review_id).first()


    if existing:
        if existing.isLike == target_is_like:   #like is removed clicking it twice
            db.session.delete(existing)
            db.session.commit()
            return jsonify({'message': 'Reaction removed', 'current_reaction': None}), 200
        else:
            existing.isLike = target_is_like    #switched to dislike case 2
            db.session.commit()
            return jsonify({'message': f'Changed to {reaction_type}', 'current_reaction': reaction_type}), 200

    new_react = ReviewReaction(userID=user_id, reviewID=review_id, isLike=target_is_like)
    db.session.add(new_react)
    db.session.commit()
    log_event(event_type=f'user_{reaction_type}d_review', user_id=user_id, description=f"{current_user.display_name} {reaction_type}d a review for film ID {target_review.tmdb_id}")
    return jsonify({'message': f'Added {reaction_type}', 'current_reaction': reaction_type}), 201
