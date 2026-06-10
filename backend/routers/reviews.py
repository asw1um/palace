from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from deps import get_current_user, get_db
from models import Review, ReviewReaction, user as User
from activity import log_event

router = APIRouter()


def _abs_url(path: str | None, request: Request) -> str | None:
    if not path:
        return None
    if path.startswith('http'):
        return path
    return f"{str(request.base_url).rstrip('/')}{path}"


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


@router.post('/')
async def upsert_review(
    body: upsert_review_request,
    request: Request,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    existing = db_session.query(Review).filter_by(
        user_id=current_user.id, tmdb_id=body.tmdb_id, media_type=body.media_type
    ).first()

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
    db_session.delete(review)
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
