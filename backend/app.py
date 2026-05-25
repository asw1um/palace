import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'use'))
from flask import Flask, jsonify, send_from_directory, send_file
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from models import db
from auth import auth
from users import users_bp
from movies import movies
from shows import shows
from progress import progress_bp
from lists import lists
from clubs import clubs
from club_lists import club_lists
from notifications import notifications
from activity import activity
from settings import settings
from reviews import reviews
from search import tmdb
import cache  # registers tmdb_cache model

# Writes PID for monitoring
pid = os.getpid()
if os.path.exists("pid.txt"):
    os.remove("pid.txt")
with open("pid.txt", "w") as f:
    f.write(str(pid))

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INSTANCE_DIR = os.path.join(BASE_DIR, 'instance')

app = Flask(
    __name__, 
    static_folder=None, 
    static_url_path=None,
    instance_path=INSTANCE_DIR,
)
app.url_map.strict_slashes = False

FRONTEND_DIST = os.path.join(BASE_DIR, '..', 'frontend', 'dist')
ASSETS_DIR = os.path.join(FRONTEND_DIST, 'assets')

app.config['JWT_SECRET_KEY'] = 'dev-secret-key-change-in-production'
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = False
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(INSTANCE_DIR, "users.db")}'   # ← absolute
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)
jwt = JWTManager(app)
CORS(app)


@jwt.token_in_blocklist_loader
def check_if_token_revoked(jwt_header, jwt_payload):
    from models import user as User
    try:
        user_id = int(jwt_payload['sub'])
    except (KeyError, ValueError):
        return True
    token_session_id = jwt_payload.get('st')
    if not token_session_id:
        return True
    current_user = db.session.get(User,user_id)
    if not current_user:
        return True
    return current_user.session_token != token_session_id

app.register_blueprint(auth, url_prefix='/api/auth')
app.register_blueprint(users_bp, url_prefix='/api/auth')
app.register_blueprint(movies, url_prefix='/api/movies')
app.register_blueprint(shows, url_prefix='/api/movies')
app.register_blueprint(progress_bp, url_prefix='/api/watchlist')
app.register_blueprint(lists, url_prefix='/api/lists')
app.register_blueprint(clubs, url_prefix='/api/clubs')
app.register_blueprint(club_lists, url_prefix='/api/clubs')
app.register_blueprint(notifications, url_prefix='/api/notifications')
app.register_blueprint(activity, url_prefix='/api/activity')
app.register_blueprint(settings, url_prefix='/api/settings')
app.register_blueprint(reviews, url_prefix='/api/reviews')
app.register_blueprint(tmdb, url_prefix='/api')

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'instance', 'uploads')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER


@app.route('/uploads/<path:filename>')
def serve_upload(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)


@app.route('/assets/<path:filename>')
def serve_assets(filename):
    response = send_from_directory(ASSETS_DIR, filename)
    response.headers['Cache-Control'] = 'public, max-age=31536000, immutable'
    return response


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    if path.startswith('api/'):
        return jsonify({'error': 'Not found'}), 404
    index_file = os.path.join(FRONTEND_DIST, 'index.html')
    response = send_file(index_file)
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response


@app.route('/api/')
def home():
    return jsonify({'message': 'Movie Track API', 'version': '1.0'})


if __name__ == '__main__':
    with app.app_context():
        db.create_all()

    app.run(debug=True)
