import sqlite3
import os
import sys

DB_PATH = os.path.join(os.path.dirname(__file__), 'instance', 'users.db')

# columns added after a table already existed, create_all doesnt add those
MIGRATIONS = [
    'ALTER TABLE reviews ADD COLUMN is_spoiler BOOLEAN NOT NULL DEFAULT 0',
]


def run():
    conn = sqlite3.connect(DB_PATH)
    for sql in MIGRATIONS:
        try:
            conn.execute(sql)
            conn.commit()
            print(f'Applied: {sql}')
        except sqlite3.OperationalError:
            # already there
            pass
    conn.close()


def fill_review_titles():
    # some reviews were saved with no title, look it up so profiles and the feed can name it
    conn = sqlite3.connect(DB_PATH)
    try:
        blank = conn.execute(
            "SELECT id, user_id, tmdb_id, media_type, created_at FROM reviews WHERE title IS NULL OR title = ''"
        ).fetchall()
    except sqlite3.OperationalError:
        blank = []
    conn.close()
    if not blank:
        return

    from search import get_movie, getShow
    found = []
    for review_id, user_id, tmdb_id, media_type, created_at in blank:
        try:
            details = getShow(tmdb_id) if media_type == 'tv' else get_movie(tmdb_id)
        except Exception:
            details = None
        if details and details.get('title'):
            found.append((review_id, user_id, created_at, details['title'], details.get('poster_url') or ''))

    conn = sqlite3.connect(DB_PATH)
    for review_id, user_id, created_at, title, poster in found:
        conn.execute("UPDATE reviews SET title = ?, poster_url = ? WHERE id = ?", (title, poster, review_id))
        # the feed entry written at the same moment ends in "reviewed" with nothing after it
        conn.execute(
            "UPDATE activity_logs SET description = rtrim(description) || ' ' || ? "
            "WHERE user_id = ? AND event_type = 'user_reviewed' AND rtrim(description) LIKE '% reviewed' "
            "AND abs(julianday(created_at) - julianday(?)) * 86400 < 10",
            (title, user_id, created_at),
        )
    conn.commit()
    conn.close()
    if found:
        print(f'Filled in {len(found)} review titles')


def convert_ratings():
    # the old site rated 1-5 stars, ratings are 0-10 now
    # one time job for data coming from that version: python migrate.py ratings
    conn = sqlite3.connect(DB_PATH)
    highest = conn.execute('SELECT MAX(rating) FROM reviews').fetchone()[0]
    if highest is None:
        print('No ratings to convert')
    elif highest > 5:
        print('Ratings are already out of 10, nothing changed')
    else:
        changed = conn.execute('UPDATE reviews SET rating = rating * 2 WHERE rating IS NOT NULL').rowcount
        conn.commit()
        print(f'Converted {changed} ratings from 5 stars to 10')
    conn.close()


if __name__ == '__main__':
    run()
    if 'ratings' in sys.argv[1:]:
        convert_ratings()
    print('Migrations done')
