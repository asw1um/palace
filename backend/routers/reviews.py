from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from deps import get_current_user, get_db
from models import Review, ReviewReaction, ReviewComment, user as User
from activity import log_event

router = APIRouter()


def _abs_url(path: str | None, request: Request) -> str | None:
    # keep it relative, the frontend proxies /uploads
    return path or None


def _enrich(review, db_session: Session, request: Request, current_user_id: int | None = None):
    data = review.to_dict(include_author=True)
    if data.get('author'):
        data['author']['profile_picture'] = _abs_url(data['author'].get('profile_picture'), request)

    likes = db_session.query(ReviewReaction).filter_by(review_id=review.id, is_like=True).count()
    dislikes = db_session.query(ReviewReaction).filter_by(review_id=review.id, is_like=False).count()

    my_reaction = None
    if current_user_id:
        r = db_session.query(ReviewReaction).filter_by(review_id=review.id, user_id=current_user_id).first()
        if r:
            my_reaction = 'like' if r.is_like else 'dislike'

    data['reactions'] = {'likes': likes, 'dislikes': dislikes, 'my_reaction': my_reaction}
    data['comment_count'] = db_session.query(ReviewComment).filter_by(review_id=review.id).count()
    return data


class upsert_review_request(BaseModel):
    tmdb_id: int
    media_type: str
    rating: float | None = None
    content: str = ''
    title: str = ''
    poster_url: str = ''
    is_spoiler: bool = False


class react_request(BaseModel):
    reaction: str


class comment_request(BaseModel):
    content: str


@router.post('')
async def upsert_review(
    body: upsert_review_request,
    request: Request,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    if body.media_type not in ('movie', 'tv'):
        raise HTTPException(status_code=400, detail='Invalid media type')
    if body.rating is not None and not 0 <= body.rating <= 10:
        raise HTTPException(status_code=400, detail='Rating must be between 0 and 10')
    if len(body.content) > 5000:
        raise HTTPException(status_code=400, detail='Review must be 5000 characters or fewer')
    if len(body.title) > 200 or len(body.poster_url) > 300:
        raise HTTPException(status_code=400, detail='Invalid title or poster')

    existing = db_session.query(Review).filter_by(
        user_id=current_user.id, tmdb_id=body.tmdb_id, media_type=body.media_type
    ).first()

    if not existing and body.rating is None and not body.content.strip():
        raise HTTPException(status_code=400, detail='Add a rating or some text')

    if existing:
        if body.rating is not None:
            existing.rating = body.rating
        if body.content:
            existing.content = body.content
        if body.title:
            existing.title = body.title
        if body.poster_url:
            existing.poster_url = body.poster_url
        existing.is_spoiler = body.is_spoiler
        db_session.commit()
        log_event(
            event_type='user_updated_review',
            user_id=current_user.id,
            description=f"{current_user.display_name} updated their review of {existing.title}",
            session=db_session,
        )
        return {'review': _enrich(existing, db_session, request, current_user.id)}

    review = Review(
        user_id=current_user.id,
        tmdb_id=body.tmdb_id,
        media_type=body.media_type,
        title=body.title,
        poster_url=body.poster_url,
        rating=body.rating,
        content=body.content,
        is_spoiler=body.is_spoiler,
    )
    db_session.add(review)
    db_session.commit()
    log_event(
        event_type='user_reviewed',
        user_id=current_user.id,
        description=f"{current_user.display_name} reviewed {review.title}",
        session=db_session,
    )
    return {'review': _enrich(review, db_session, request, current_user.id)}


@router.delete('/{review_id}')
async def delete_review(
    review_id: int,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    review = db_session.get(Review, review_id)
    if not review:
        raise HTTPException(status_code=404)
    if review.user_id != current_user.id:
        raise HTTPException(status_code=403, detail='Not your review')
    db_session.query(ReviewComment).filter_by(review_id=review.id).delete()
    db_session.query(ReviewReaction).filter_by(review_id=review.id).delete()
    db_session.delete(review)
    db_session.commit()
    return {'message': 'Deleted'}


@router.get('/{review_id}/comments')
async def get_comments(
    review_id: int,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    comments = db_session.query(ReviewComment).filter_by(review_id=review_id)\
        .order_by(ReviewComment.created_at.asc()).all()
    return {'comments': [c.to_dict() for c in comments]}


@router.post('/{review_id}/comments', status_code=201)
async def add_comment(
    review_id: int,
    body: comment_request,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    review = db_session.get(Review, review_id)
    if not review:
        raise HTTPException(status_code=404)
    content = body.content.strip()
    if not content or len(content) > 1000:
        raise HTTPException(status_code=400, detail='Comment must be 1 to 1000 characters')

    comment = ReviewComment(review_id=review_id, user_id=current_user.id, content=content)
    db_session.add(comment)
    db_session.commit()
    return {'comment': comment.to_dict()}


@router.delete('/comments/{comment_id}')
async def delete_comment(
    comment_id: int,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    comment = db_session.get(ReviewComment, comment_id)
    if not comment:
        raise HTTPException(status_code=404)
    review = db_session.get(Review, comment.review_id)
    # the commenter or whoever wrote the review can remove it
    if current_user.id not in (comment.user_id, review.user_id if review else None):
        raise HTTPException(status_code=403, detail='Not your comment')
    db_session.delete(comment)
    db_session.commit()
    return {'message': 'Deleted'}


@router.get('/title/{tmdb_id}/{media_type}')
async def get_title_reviews(
    tmdb_id: int,
    media_type: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    reviews = db_session.query(Review).filter_by(tmdb_id=tmdb_id, media_type=media_type)\
        .order_by(Review.created_at.desc()).all()
    return {'reviews': [_enrich(r, db_session, request, current_user.id) for r in reviews]}


@router.get('/me/{tmdb_id}/{media_type}')
async def get_my_review(
    tmdb_id: int,
    media_type: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    review = db_session.query(Review).filter_by(
        user_id=current_user.id, tmdb_id=tmdb_id, media_type=media_type
    ).first()
    if not review:
        return {'review': None}
    return {'review': _enrich(review, db_session, request, current_user.id)}


@router.get('/user/{target_user_id}')
async def get_user_reviews(
    target_user_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    reviews = db_session.query(Review).filter_by(user_id=target_user_id)\
        .order_by(Review.created_at.desc()).all()
    return {'reviews': [_enrich(r, db_session, request, current_user.id) for r in reviews]}


@router.post('/{review_id}/react')
async def react_to_review(
    review_id: int,
    body: react_request,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    review = db_session.get(Review, review_id)
    if not review:
        raise HTTPException(status_code=404)

    if body.reaction not in ('like', 'dislike'):
        raise HTTPException(status_code=400, detail='reaction must be like or dislike')

    is_like = body.reaction == 'like'
    existing = db_session.query(ReviewReaction).filter_by(user_id=current_user.id, review_id=review_id).first()

    if existing:
        if existing.is_like == is_like:
            db_session.delete(existing)
            db_session.commit()
            return {'message': 'Reaction removed', 'current_reaction': None}
        existing.is_like = is_like
        db_session.commit()
        return {'message': f'Changed to {body.reaction}', 'current_reaction': body.reaction}

    db_session.add(ReviewReaction(user_id=current_user.id, review_id=review_id, is_like=is_like))
    db_session.commit()
    log_event(
        event_type=f'user_{body.reaction}d_review',
        user_id=current_user.id,
        description=f"{current_user.display_name} {body.reaction}d a review for film ID {review.tmdb_id}",
        session=db_session,
    )
    return {'message': f'Added {body.reaction}', 'current_reaction': body.reaction}
