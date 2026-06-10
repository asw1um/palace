import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'instance', 'users.db')

MIGRATIONS = [
    'ALTER TABLE reviews ADD COLUMN is_spoiler BOOLEAN NOT NULL DEFAULT 0',
]

conn = sqlite3.connect(DB_PATH)
for sql in MIGRATIONS:
    try:
        conn.execute(sql)
        conn.commit()
        print(f'Applied: {sql}')
    except Exception as e:
        print(f'Skipped: {e}')
conn.close()
print('Migrations done')
