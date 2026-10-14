import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from models.database import Base, init_db
from migrate import run as run_migrations, fill_review_titles
from routers import auth, users, settings, notifications, movies, shows, progress, lists, clubs, club_lists, reviews, search, custom_media, activity, shared

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INSTANCE_DIR = os.path.join(BASE_DIR, 'instance')
FRONTEND_DIST = os.path.join(BASE_DIR, '..', 'frontend', 'dist')
UPLOAD_FOLDER = os.path.join(INSTANCE_DIR, 'uploads')
DATABASE_URL = f'sqlite:///{os.path.join(INSTANCE_DIR, "users.db")}'

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

engine = init_db(DATABASE_URL)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    run_migrations()
    try:
        fill_review_titles()
    except Exception as e:
        print(f'Could not fill review titles: {e}')
    yield


app = FastAPI(title='Palace API', version='1.0', lifespan=lifespan, redirect_slashes=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

# biggest upload is a 5MB image, anything larger gets dropped before its read
MAX_BODY_BYTES = 6 * 1024 * 1024


# requests per minute per ip, the proxy in front has to pass X-Forwarded-For
RATE_LIMIT = int(os.getenv('RATE_LIMIT_PER_MIN', '600'))
_hits = {}


def _over_limit(ip):
    minute = int(time.time() // 60)
    seen_minute, count = _hits.get(ip, (minute, 0))
    if seen_minute != minute:
        count = 0
    if len(_hits) > 20000:
        _hits.clear()
    _hits[ip] = (minute, count + 1)
    return count + 1 > RATE_LIMIT


@app.middleware('http')
async def limit_requests(request, call_next):
    size = request.headers.get('content-length')
    if size and size.isdigit() and int(size) > MAX_BODY_BYTES:
        return JSONResponse({'detail': 'Request too large'}, status_code=413)
    if request.url.path.startswith('/api/') and request.client and _over_limit(request.client.host):
        return JSONResponse({'detail': 'Too many requests, slow down'}, status_code=429)
    return await call_next(request)


# routers
app.include_router(auth.router, prefix='/api/auth')
app.include_router(users.router, prefix='/api/auth')
app.include_router(movies.router, prefix='/api/movies')
app.include_router(shows.router, prefix='/api/movies')
app.include_router(progress.router, prefix='/api/watchlist')
app.include_router(lists.router, prefix='/api/lists')
app.include_router(clubs.router, prefix='/api/clubs')
app.include_router(club_lists.router, prefix='/api/clubs')
app.include_router(notifications.router, prefix='/api/notifications')
app.include_router(activity.router, prefix='/api/activity')
app.include_router(settings.router, prefix='/api/settings')
app.include_router(reviews.router, prefix='/api/reviews')
app.include_router(custom_media.router, prefix='/api/custom-media')
app.include_router(shared.router, prefix='/api/shared')
app.include_router(search.router, prefix='/api')

# static file serving
if os.path.isdir(UPLOAD_FOLDER):
    app.mount('/uploads', StaticFiles(directory=UPLOAD_FOLDER), name='uploads')

ASSETS_DIR = os.path.realpath(os.path.join(FRONTEND_DIST, 'assets'))


@app.get('/api/')
async def api_root():
    return {'message': 'Palace API', 'version': '1.0'}


@app.get('/assets/{path:path}', include_in_schema=False)
async def serve_assets(path: str):
    # block ../ paths from leaving the assets folder
    file_path = os.path.realpath(os.path.join(ASSETS_DIR, path))
    if not file_path.startswith(ASSETS_DIR + os.sep) or not os.path.isfile(file_path):
        raise HTTPException(status_code=404)
    return FileResponse(
        file_path,
        headers={'Cache-Control': 'public, max-age=31536000, immutable'},
    )


@app.get('/{full_path:path}', include_in_schema=False)
async def serve_spa(full_path: str):
    if full_path.startswith('api'):
        raise HTTPException(status_code=404, detail='Not found')
    index_path = os.path.join(FRONTEND_DIST, 'index.html')
    if not os.path.isfile(index_path):
        raise HTTPException(status_code=404, detail='Frontend not built')
    return FileResponse(
        index_path,
        headers={'Cache-Control': 'no-cache, no-store, must-revalidate'},
    )
