from models import db, activity_log


def log_event(event_type, user_id=None, club_id=None, list_id=None,
              movie_id=None, show_id=None, target_user_id=None,
              description=None, extra_data=None, session=None):
    entry = activity_log(
        event_type=event_type,
        user_id=user_id,
        club_id=club_id,
        list_id=list_id,
        movie_id=movie_id,
        show_id=show_id,
        target_user_id=target_user_id,
        description=description or '',
        data=extra_data or {},
    )
    sess = session or db.session
    sess.add(entry)
    sess.commit()
    return entry