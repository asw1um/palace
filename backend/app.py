from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from search import searchMovie, searchShow, searchMulti, discoverTrending
from dbstruct import db, user, movie
from auth import auth
from watchlist import movies
from lists import lists
from clubs import clubs
from notifications import notifications
from activity import activity
import cache  # registers tmdb_cache model

app = Flask(__name__)
app.config['JWT_SECRET_KEY'] = 'dev-secret-key-change-in-production'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# initialize extensions here
db.init_app(app)
jwt = JWTManager(app)
CORS(app)

# register blueprints here
app.register_blueprint(auth, url_prefix='/api/auth')
app.register_blueprint(movies, url_prefix='/api/movies')
app.register_blueprint(lists, url_prefix='/api/lists')
app.register_blueprint(clubs, url_prefix='/api/clubs')
app.register_blueprint(notifications, url_prefix='/api/notifications')
app.register_blueprint(activity, url_prefix='/api/activity')

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


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        
    app.run(debug=True)
