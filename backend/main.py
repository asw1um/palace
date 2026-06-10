import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from models.database import Base, init_db
from routers import auth, users, settings, notifications, movies, shows, progress, lists, clubs, club_lists, reviews, search, custom_media, activity

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
    yield


app = FastAPI(title='Palace API', version='1.0', lifespan=lifespan, redirect_slashes=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

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
app.include_router(search.router, prefix='/api')

# static file serving
if os.path.isdir(UPLOAD_FOLDER):
    app.mount('/uploads', StaticFiles(directory=UPLOAD_FOLDER), name='uploads')

ASSETS_DIR = os.path.join(FRONTEND_DIST, 'assets')


@app.get('/api/')
async def api_root():
    return {'message': 'Palace API', 'version': '1.0'}


@app.get('/assets/{path:path}', include_in_schema=False)
async def serve_assets(path: str):
    file_path = os.path.join(ASSETS_DIR, path)
    if not os.path.isfile(file_path):
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
