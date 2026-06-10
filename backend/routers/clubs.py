import os
import time

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session
from werkzeug.utils import secure_filename

from deps import get_current_user, get_db
from models import user as User, club as Club, movielist
from activity import log_event

router = APIRouter()

CLUB_IMAGE_FOLDER = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'instance', 'uploads', 'clubs')
os.makedirs(CLUB_IMAGE_FOLDER, exist_ok=True)
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}


def _allowed_file(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def _abs_url(path: str | None, request: Request) -> str | None:
    if not path:
        return None
    if path.startswith('http'):
        return path
    return f"{str(request.base_url).rstrip('/')}{path}"


class create_club_request(BaseModel):
    name: str
    description: str = ''


class update_club_request(BaseModel):
    name: str | None = None
    description: str | None = None


class rename_club_request(BaseModel):
    name: str


@router.get('')
@router.get('/')
async def get_clubs(
    request: Request,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    def _club_dict(c):
        data = c.to_dict()
        data['image_url'] = _abs_url(data.get('image_url'), request)
        return data

    return {
        'my_clubs': [_club_dict(c) for c in current_user.clubs],
        'all_clubs': [_club_dict(c) for c in db_session.query(Club).all()],
    }


@router.post('/', status_code=201)
async def create_club(
    body: create_club_request,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail='Club name cannot be empty')

    new_club = Club(name=name, description=body.description, admin_id=current_user.id)
    new_club.members.append(current_user)
    db_session.add(new_club)
    db_session.flush()

    for default_name in ['Currently Watching', 'Want to Watch', 'Watched']:
        db_session.add(movielist(name=default_name, club_id=new_club.id))
    db_session.commit()

    log_event(
        event_type='user_created_club',
        user_id=current_user.id,
        club_id=new_club.id,
        description=f"Created club: {name}",
        extra_data={'club_name': name},
        session=db_session,
    )
    return {'message': f'Created club: {name}', 'club': new_club.to_dict()}


@router.get('/pinned')
async def get_pinned_clubs(
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    pinned_ids = current_user.pinned_club_ids or []
    pinned = db_session.query(Club).filter(Club.id.in_(pinned_ids)).all()
    return {'clubs': [c.to_dict() for c in pinned]}


@router.get('/my-clubs-with-lists')
async def get_my_clubs_with_lists(
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    clubs_data = []
    for c in current_user.clubs:
        data = c.to_dict()
        data['lists'] = [lst.to_dict(include_movies=True, include_shows=True) for lst in c.lists]
        clubs_data.append(data)
    return {'clubs': clubs_data}


@router.get('/{club_id}')
async def get_club(
    club_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    club_obj = db_session.get(Club, club_id)
    if not club_obj:
        raise HTTPException(status_code=404)
    data = club_obj.to_dict(include_members=True, include_lists=True)
    data['image_url'] = _abs_url(data.get('image_url'), request)
    for member in data.get('members', []):
        member['profile_picture'] = _abs_url(member.get('profile_picture'), request)
        member['banner'] = _abs_url(member.get('banner'), request)
    return {'club': data}


@router.put('/{club_id}')
async def update_club(
    club_id: int,
    body: update_club_request,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    club_obj = db_session.get(Club, club_id)
    if not club_obj:
        raise HTTPException(status_code=404)
    if not club_obj.can_manage(current_user):
        raise HTTPException(status_code=403, detail='Only the club admin or a mod can edit this club')
    if body.name and body.name.strip():
        club_obj.name = body.name.strip()
    if body.description is not None:
        club_obj.description = body.description.strip()
    db_session.commit()
    return {'club': club_obj.to_dict()}


@router.delete('/{club_id}')
async def delete_club(
    club_id: int,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    club_obj = db_session.get(Club, club_id)
    if not club_obj:
        raise HTTPException(status_code=404)
    if club_obj.admin_id != current_user.id:
        raise HTTPException(status_code=403, detail='Only admin can delete')

    club_name = club_obj.name
    log_event(
        event_type='user_deleted_club',
        user_id=current_user.id,
        club_id=club_obj.id,
        description=f"Deleted club: {club_name}",
        extra_data={'club_name': club_name},
        session=db_session,
    )
    db_session.delete(club_obj)
    db_session.commit()
    return {'message': f'Deleted club: {club_name}'}


@router.post('/{club_id}/rename')
async def rename_club(
    club_id: int,
    body: rename_club_request,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    club_obj = db_session.get(Club, club_id)
    if not club_obj:
        raise HTTPException(status_code=404)
    if not club_obj.can_manage(current_user):
        raise HTTPException(status_code=403, detail='Only admin or mod can rename')
    new_name = body.name.strip()
    if not new_name:
        raise HTTPException(status_code=400, detail='Name cannot be empty')

    old_name = club_obj.name
    club_obj.name = new_name
    db_session.commit()

    log_event(
        event_type='user_renamed_club',
        user_id=current_user.id,
        club_id=club_obj.id,
        description=f"Renamed club from '{old_name}' to '{new_name}'",
        extra_data={'old_name': old_name, 'new_name': new_name},
        session=db_session,
    )
    return {'message': f'Renamed club to: {new_name}', 'club': club_obj.to_dict()}


@router.post('/{club_id}/upload-image')
async def upload_club_image(
    club_id: int,
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    club_obj = db_session.get(Club, club_id)
    if not club_obj:
        raise HTTPException(status_code=404)
    if not club_obj.can_manage(current_user):
        raise HTTPException(status_code=403, detail='Only the club admin or a mod can change the club image')
    if not file.filename or not _allowed_file(file.filename):
        raise HTTPException(status_code=400, detail='Invalid file type')

    ext = file.filename.rsplit('.', 1)[1].lower()
    filename = f"club_{club_id}_{int(time.time())}.{ext}"
    filepath = os.path.join(CLUB_IMAGE_FOLDER, filename)
    content = await file.read()
    with open(filepath, 'wb') as f:
        f.write(content)

    url = f"/uploads/clubs/{filename}"
    club_obj.image_url = url
    db_session.commit()
    return {'url': _abs_url(url, request)}


@router.post('/{club_id}/join')
async def join_club(
    club_id: int,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    club_obj = db_session.get(Club, club_id)
    if not club_obj:
        raise HTTPException(status_code=404)
    if club_obj.is_member(current_user):
        raise HTTPException(status_code=400, detail='Already a member')

    club_obj.add_member(current_user)
    db_session.commit()

    log_event(
        event_type='user_joined_club',
        user_id=current_user.id,
        club_id=club_obj.id,
        description=f"Joined club: {club_obj.name}",
        extra_data={'club_name': club_obj.name, 'member_count': len(club_obj.members)},
        session=db_session,
    )
    return {'message': f'Joined club: {club_obj.name}'}


@router.post('/{club_id}/leave')
async def leave_club(
    club_id: int,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    club_obj = db_session.get(Club, club_id)
    if not club_obj:
        raise HTTPException(status_code=404)
    if not club_obj.is_member(current_user):
        raise HTTPException(status_code=400, detail='Not a member')

    club_obj.remove_member(current_user)
    db_session.commit()

    log_event(
        event_type='user_left_club',
        user_id=current_user.id,
        club_id=club_obj.id,
        description=f"Left club: {club_obj.name}",
        extra_data={'club_name': club_obj.name},
        session=db_session,
    )
    return {'message': f'Left club: {club_obj.name}'}


@router.post('/{club_id}/mods/{target_user_id}')
async def grant_mod(
    club_id: int,
    target_user_id: int,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    club_obj = db_session.get(Club, club_id)
    if not club_obj:
        raise HTTPException(status_code=404)
    if club_obj.admin_id != current_user.id:
        raise HTTPException(status_code=403, detail='Only the admin can grant mod status')
    if target_user_id == current_user.id:
        raise HTTPException(status_code=400, detail='Admin is already the owner')
    target = db_session.get(User, target_user_id)
    if not target or not club_obj.is_member(target):
        raise HTTPException(status_code=400, detail='User is not a member')

    mods = list(club_obj.mod_ids or [])
    if target_user_id not in mods:
        mods.append(target_user_id)
        club_obj.mod_ids = mods
    club_obj.helper_ids = [h for h in (club_obj.helper_ids or []) if h != target_user_id]
    db_session.commit()
    return {'mod_ids': club_obj.mod_ids, 'helper_ids': club_obj.helper_ids}


@router.delete('/{club_id}/mods/{target_user_id}')
async def revoke_mod(
    club_id: int,
    target_user_id: int,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    club_obj = db_session.get(Club, club_id)
    if not club_obj:
        raise HTTPException(status_code=404)
    if club_obj.admin_id != current_user.id:
        raise HTTPException(status_code=403, detail='Only the admin can revoke mod status')
    club_obj.mod_ids = [m for m in (club_obj.mod_ids or []) if m != target_user_id]
    db_session.commit()
    return {'mod_ids': club_obj.mod_ids}


@router.post('/{club_id}/helpers/{target_user_id}')
async def grant_helper(
    club_id: int,
    target_user_id: int,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    club_obj = db_session.get(Club, club_id)
    if not club_obj:
        raise HTTPException(status_code=404)
    if club_obj.admin_id != current_user.id:
        raise HTTPException(status_code=403, detail='Only the admin can grant helper status')
    if target_user_id == current_user.id:
        raise HTTPException(status_code=400, detail='Admin cannot assign roles to themselves')
    target = db_session.get(User, target_user_id)
    if not target or not club_obj.is_member(target):
        raise HTTPException(status_code=400, detail='User is not a member')

    helpers = list(club_obj.helper_ids or [])
    if target_user_id not in helpers:
        helpers.append(target_user_id)
        club_obj.helper_ids = helpers
    club_obj.mod_ids = [m for m in (club_obj.mod_ids or []) if m != target_user_id]
    db_session.commit()
    return {'helper_ids': club_obj.helper_ids, 'mod_ids': club_obj.mod_ids}


@router.delete('/{club_id}/helpers/{target_user_id}')
async def revoke_helper(
    club_id: int,
    target_user_id: int,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    club_obj = db_session.get(Club, club_id)
    if not club_obj:
        raise HTTPException(status_code=404)
    if club_obj.admin_id != current_user.id and not club_obj.is_mod(current_user):
        raise HTTPException(status_code=403, detail='Only admin or mod can revoke helper status')
    club_obj.helper_ids = [h for h in (club_obj.helper_ids or []) if h != target_user_id]
    db_session.commit()
    return {'helper_ids': club_obj.helper_ids}


@router.post('/{club_id}/kick/{target_user_id}')
async def kick_member(
    club_id: int,
    target_user_id: int,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    club_obj = db_session.get(Club, club_id)
    if not club_obj:
        raise HTTPException(status_code=404)
    if club_obj.admin_id != current_user.id and not club_obj.is_mod(current_user):
        raise HTTPException(status_code=403, detail='Only admin or mod can kick members')
    target = db_session.get(User, target_user_id)
    if not target:
        raise HTTPException(status_code=404)
    if club_obj.is_mod(target) and club_obj.admin_id != current_user.id:
        raise HTTPException(status_code=403, detail='Only admin can kick a mod')
    if target_user_id == current_user.id:
        raise HTTPException(status_code=400, detail='Cannot kick yourself')
    if not club_obj.is_member(target):
        raise HTTPException(status_code=400, detail='User is not a member')

    club_obj.remove_member(target)
    club_obj.mod_ids = [m for m in (club_obj.mod_ids or []) if m != target_user_id]
    club_obj.helper_ids = [h for h in (club_obj.helper_ids or []) if h != target_user_id]
    db_session.commit()
    return {'message': f'Kicked {target.username}'}


@router.post('/{club_id}/pin')
async def pin_club(
    club_id: int,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    if not db_session.get(Club, club_id):
        raise HTTPException(status_code=404)
    pinned = list(current_user.pinned_club_ids or [])
    if club_id not in pinned:
        if len(pinned) >= 4:
            raise HTTPException(status_code=400, detail='Maximum of 4 pinned clubs allowed')
        current_user.pinned_club_ids = pinned + [club_id]
        db_session.commit()
    return {'message': 'Club pinned'}


@router.post('/{club_id}/unpin')
async def unpin_club(
    club_id: int,
    current_user: User = Depends(get_current_user),
    db_session: Session = Depends(get_db),
):
    pinned = list(current_user.pinned_club_ids or [])
    if club_id in pinned:
        current_user.pinned_club_ids = [p for p in pinned if p != club_id]
        db_session.commit()
    return {'message': 'Club unpinned'}