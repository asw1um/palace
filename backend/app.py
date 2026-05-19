import os
from flask import Flask, jsonify, request, send_from_directory, send_file
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from search import searchMovie, searchShow, searchMulti, discoverTrending, getMovie, getShow, getSeasonDetails, searchPerson, getPersonCredits
from dbstruct import db, user, movie
from auth import auth
from watchlist import movies, watchlist
from lists import lists
from clubs import clubs
from notifications import notifications
from activity import activity
from settings import settings
from reviews import reviews
import cache  # registers tmdb_cache model

app = Flask(__name__, static_folder=None, static_url_path=None)
app.url_map.strict_slashes = False

# frontend dist folder
FRONTEND_DIST = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend', 'dist')
ASSETS_DIR = os.path.join(FRONTEND_DIST, 'assets')
app.config['JWT_SECRET_KEY'] = 'dev-secret-key-change-in-production'
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = False
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# initialize extensions here
db.init_app(app)
jwt = JWTManager(app)
CORS(app)

# register blueprints here
app.register_blueprint(auth, url_prefix='/api/auth')
app.register_blueprint(movies, url_prefix='/api/movies')
app.register_blueprint(watchlist, url_prefix='/api/watchlist')
app.register_blueprint(lists, url_prefix='/api/lists')
app.register_blueprint(clubs, url_prefix='/api/clubs')
app.register_blueprint(notifications, url_prefix='/api/notifications')
app.register_blueprint(activity, url_prefix='/api/activity')
app.register_blueprint(settings, url_prefix='/api/settings')
app.register_blueprint(reviews, url_prefix='/api/reviews')

# uploads
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'instance', 'uploads')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER


@app.route('/uploads/<path:filename>')
def serve_upload(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)


# Serve built frontend assets
@app.route('/assets/<path:filename>')
def serve_assets(filename):
    response = send_from_directory(ASSETS_DIR, filename)
    response.headers['Cache-Control'] = 'public, max-age=31536000, immutable'
    return response


# Serve React frontend (SPA catch-all)
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


# route here
@app.route('/api/')
def home():
    return jsonify({
        'message': 'Movie Track API',
        'version': '1.0'
    })


@app.route('/api/search')
def search():
    query = request.args.get('query', '')
    results = searchMovie(query) if query else []
    return jsonify({'query': query, 'results': results})


@app.route('/api/search/tv')
def search_tv():
    query = request.args.get('query', '')
    results = searchShow(query) if query else []
    return jsonify({'query': query, 'results': results})


@app.route('/api/search/multi')
def search_multi():
    query = request.args.get('query', '')
    results = searchMulti(query) if query else []
    return jsonify({'query': query, 'results': results})


@app.route('/api/discover')
def discover():
    results = discoverTrending()
    return jsonify({'results': results})


@app.route('/api/movie/<int:movie_id>')
def movie_detail(movie_id):
    result = getMovie(movie_id)
    if not result:
        return jsonify({'error': 'Movie not found'}), 404
    return jsonify(result)


@app.route('/api/tv/<int:show_id>')
def show_detail(show_id):
    result = getShow(show_id)
    if not result:
        return jsonify({'error': 'Show not found'}), 404
    return jsonify(result)


@app.route('/api/search/person')
def search_person():
    query = request.args.get('query', '')
    results = searchPerson(query) if query else []
    return jsonify({'query': query, 'results': results})


@app.route('/api/person/<int:person_id>/credits')
def person_credits(person_id):
    result = getPersonCredits(person_id)
    if not result:
        return jsonify({'error': 'Person not found'}), 404
    return jsonify(result)


@app.route('/api/tv/<int:show_id>/season/<int:season_number>')
def season_detail(show_id, season_number):
    result = getSeasonDetails(show_id, season_number)
    if not result:
        return jsonify({'error': 'Season not found'}), 404
    return jsonify(result)


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        
    app.run(debug=True)
