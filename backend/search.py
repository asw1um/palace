import os
import requests
from flask import Blueprint, request, jsonify
from dotenv import load_dotenv
from cache import cache_get, cache_set, cache_flush, cache_flush_expired

tmdb = Blueprint('tmdb', __name__)

load_dotenv()

apiKey = os.getenv('TMDB_API_KEY')
baseURL = "https://api.themoviedb.org/3"
imageBaseURL = "https://image.tmdb.org/t/p"
posterSize = "w500"
backdropSize = "w1280"
profileSize = "h632"


def getPosterURL(posterPath):
    if posterPath:
        return f"{imageBaseURL}/{posterSize}{posterPath}"
    return None


def getBackdropURL(backdropPath):
    if backdropPath:
        return f"{imageBaseURL}/{backdropSize}{backdropPath}"
    return None


def getProfileURL(profilePath):
    if profilePath:
        return f"{imageBaseURL}/{profileSize}{profilePath}"
    return None


def _cache_key(url, params=None):
    return f"{url}:{repr(sorted((params or {}).items()))}"


# ttl list, tuneable here
_TTL_FOREVER  = 365 * 24 # movies and ended/cancelled shows: 1 year
_TTL_DETAILS  = 7 * 24   # celeb credits: 7 days
_TTL_SEASON   = 7 * 24   # season episode lists: 7 days 
_TTL_POPULAR  = 24       # trending: 1 day
_TTL_SEARCH   = 30 * 24  # search results: 30 days

_ENDED_STATUSES = {'Ended', 'Canceled', 'Cancelled'}


def _cached_tmdb_request(url, params=None, ttl_hours=_TTL_DETAILS):
    key = _cache_key(url, params)
    cached = cache_get(key)
    if cached is not None:
        return cached

    data = _tmdb_request(url, params)
    if data is not None:
        cache_set(key, data, ttl_hours=ttl_hours)
    return data


def _tmdb_request(url, params=None):
    p = {"api_key": apiKey, "language": "en-US"}
    if params:
        p.update(params)
    response = requests.get(url, params=p, timeout=10)
    if response.status_code == 200:
        try:
            return response.json()
        except Exception:
            print(f"TMDB invalid response body: {url} — {response.text[:200]!r}")
            return None
    print(f"TMDB Error {response.status_code}: {url}")
    return None


def clear_tmdb_cache():
    cache_flush()


def flush_expired_tmdb_cache():
    cache_flush_expired()


def _format_cast(credits):
    if not credits:
        return []
    return [
        {
            'id': c.get('id'),
            'name': c.get('name'),
            'character': c.get('character'),
            'profile_url': getProfileURL(c.get('profile_path')),
            'order': c.get('order', 999)
        }
        for c in credits.get('cast', [])[:15]  # top 15 billed cast
    ]


def _format_trailer(videos):
    if not videos:
        return None
    results = videos.get('results', [])
    # prefer official trailers
    for v in results:
        if v.get('type') == 'Trailer' and v.get('site') == 'YouTube' and v.get('official'):
            return v.get('key')
    # fallback to any trailer
    for v in results:
        if v.get('type') == 'Trailer' and v.get('site') == 'YouTube':
            return v.get('key')
    # fallback to any video
    for v in results:
        if v.get('site') == 'YouTube':
            return v.get('key')
    return None


def formatMulti(item):
    media_type = item.get('media_type')
    base = {
        'id': item.get('id'),
        'media_type': media_type,
        'title': item.get('title') or item.get('name'),
        'overview': item.get('overview'),
        'poster_url': getPosterURL(item.get('poster_path')),
        'backdrop_url': getBackdropURL(item.get('backdrop_path')),
        'release_date': item.get('release_date') or item.get('first_air_date'),
        'rating': item.get('vote_average'),
        'popularity': item.get('popularity'),
        'genre_ids': item.get('genre_ids', [])
    }
    if media_type == 'tv':
        base['number_of_seasons'] = item.get('number_of_seasons')
    return base


def formatMovie(movie):
    result = formatMulti(movie)
    result['media_type'] = 'movie'
    result['runtime'] = movie.get('runtime')
    result['tagline'] = movie.get('tagline')
    result['status'] = movie.get('status')
    result['homepage'] = movie.get('homepage')
    result['imdb_id'] = movie.get('imdb_id')
    result['original_language'] = movie.get('original_language')
    result['genres'] = [g.get('name') for g in movie.get('genres', [])]
    result['cast'] = _format_cast(movie.get('credits'))
    result['trailer_key'] = _format_trailer(movie.get('videos'))
    result['tmdb_url'] = f"https://www.themoviedb.org/movie/{movie.get('id')}"
    return result


def formatShow(show_data):
    result = formatMulti(show_data)
    result['media_type'] = 'tv'
    result['status'] = show_data.get('status')
    result['tagline'] = show_data.get('tagline')
    result['homepage'] = show_data.get('homepage')
    result['number_of_episodes'] = show_data.get('number_of_episodes')
    result['episode_run_time'] = show_data.get('episode_run_time', [])
    result['in_production'] = show_data.get('in_production')
    result['original_language'] = show_data.get('original_language')
    result['genres'] = [g.get('name') for g in show_data.get('genres', [])]
    result['created_by'] = [
        {'id': c.get('id'), 'name': c.get('name'), 'profile_url': getProfileURL(c.get('profile_path'))}
        for c in show_data.get('created_by', [])
    ]
    result['cast'] = _format_cast(show_data.get('credits'))
    result['trailer_key'] = _format_trailer(show_data.get('videos'))
    result['tmdb_url'] = f"https://www.themoviedb.org/tv/{show_data.get('id')}"
    return result


def _search(endpoint, query):
    data = _cached_tmdb_request(f"{baseURL}/{endpoint}", {"query": query, "page": 1}, ttl_hours=_TTL_SEARCH)
    if data:
        return data.get("results", [])
    return []


def searchMovie(query):
    return [formatMovie(m) for m in _search("search/movie", query)]


def searchShow(query):
    return [formatShow(s) for s in _search("search/tv", query)]


def searchMulti(query):
    data = _cached_tmdb_request(f"{baseURL}/search/multi", {"query": query, "page": 1}, ttl_hours=_TTL_SEARCH)
    if not data:
        return []
    results = [
        formatMulti(item)
        for item in data.get("results", [])
        if item.get('media_type') in ('movie', 'tv')
    ]
    results.sort(key=lambda x: x.get('popularity') or 0, reverse=True)
    return results


_APPEND = "credits,videos,similar,recommendations,images,watch/providers"


def getMovie(movieID):
    data = _cached_tmdb_request(
        f"{baseURL}/movie/{movieID}",
        {"append_to_response": _APPEND},
        ttl_hours=_TTL_FOREVER,
    )
    return formatMovie(data) if data else None


def getShow(showID):
    url = f"{baseURL}/tv/{showID}"
    params = {"append_to_response": _APPEND}
    key = _cache_key(url, params)

    data = cache_get(key)
    if data is None:
        data = _tmdb_request(url, params)
        if data and data.get('status') in _ENDED_STATUSES:
            cache_set(key, data, ttl_hours=_TTL_FOREVER)

    if not data:
        return None
    result = formatShow(data)
    result['seasons'] = [
        {'season_number': s.get('season_number'), 'episode_count': s.get('episode_count')}
        for s in data.get('seasons', [])
        if s.get('episode_count', 0) > 0
    ]
    return result


def getSeasonDetails(showID, seasonNumber):
    data = _cached_tmdb_request(f"{baseURL}/tv/{showID}/season/{seasonNumber}", ttl_hours=_TTL_SEASON)
    if not data:
        return None
    return {
        'season_number': data.get('season_number'),
        'name': data.get('name'),
        'overview': data.get('overview'),
        'episodes': [
            {
                'episode_number': ep.get('episode_number'),
                'name': ep.get('name'),
                'overview': ep.get('overview') or '',
                'air_date': ep.get('air_date') or '',
                'runtime': ep.get('runtime'),
                'still_url': getPosterURL(ep.get('still_path')) if ep.get('still_path') else None,
            }
            for ep in data.get('episodes', [])
        ]
    }


_MIN_PERSON_POPULARITY = 1.0

def searchPerson(query):
    data = _cached_tmdb_request(f"{baseURL}/search/person", {"query": query, "page": 1}, ttl_hours=_TTL_SEARCH)
    if not data:
        return []
    results = []
    candidates = [p for p in data.get("results", []) if p.get('popularity', 0) >= _MIN_PERSON_POPULARITY]
    for p in candidates[:12]:
        results.append({
            'id': p.get('id'),
            'name': p.get('name'),
            'profile_url': getProfileURL(p.get('profile_path')),
            'department': p.get('known_for_department', ''),
            'popularity': p.get('popularity', 0),
            'known_for': [
                {
                    'id': k.get('id'),
                    'title': k.get('title') or k.get('name'),
                    'media_type': k.get('media_type'),
                    'poster_url': getPosterURL(k.get('poster_path')),
                }
                for k in p.get('known_for', [])[:3]
            ]
        })
    return results


def getPersonCredits(person_id):
    # single request: person details + combined_credits to append_to_response (less http requests)
    data = _cached_tmdb_request(
        f"{baseURL}/person/{person_id}",
        {"append_to_response": "combined_credits"},
    )
    if not data:
        return None

    credits = data.get('combined_credits', {})

    seen = set()
    items = []

    for entry in credits.get('cast', []) + credits.get('crew', []):
        mt = entry.get('media_type')
        if mt not in ('movie', 'tv'):
            continue
        key = (entry.get('id'), mt)
        if key in seen:
            continue
        seen.add(key)
        role = entry.get('character') or entry.get('job') or ''
        items.append({
            'id': entry.get('id'),
            'media_type': mt,
            'title': entry.get('title') or entry.get('name'),
            'poster_url': getPosterURL(entry.get('poster_path')),
            'release_date': entry.get('release_date') or entry.get('first_air_date') or '',
            'rating': entry.get('vote_average'),
            'popularity': entry.get('popularity', 0),
            'role': role,
        })

    items.sort(key=lambda x: x.get('popularity') or 0, reverse=True)

    return {
        'id': person_id,
        'name': data.get('name', ''),
        'profile_url': getProfileURL(data.get('profile_path')),
        'department': data.get('known_for_department', ''),
        'biography': data.get('biography', ''),
        'credits': items,
    }


def discoverTrending():
    data = _cached_tmdb_request(f"{baseURL}/trending/all/week", {"page": 1}, ttl_hours=_TTL_POPULAR)
    if not data:
        return []
    results = []
    for item in data.get("results", []):
        mt = item.get('media_type')
        if mt == 'movie':
            results.append(formatMovie(item))
        elif mt == 'tv':
            results.append(formatShow(item))
    return results


def discoverPopularMovies():
    data = _cached_tmdb_request(f"{baseURL}/movie/popular", {"page": 1}, ttl_hours=_TTL_POPULAR)
    if not data:
        return []
    return [formatMovie(m) for m in data.get("results", [])]


def discoverPopularShows():
    data = _cached_tmdb_request(f"{baseURL}/tv/popular", {"page": 1}, ttl_hours=_TTL_POPULAR)
    if not data:
        return []
    return [formatShow(s) for s in data.get("results", [])]

# routes

@tmdb.route('/search')
def search():
    query = request.args.get('query', '')
    results = searchMovie(query) if query else []
    return jsonify({'query': query, 'results': results})


@tmdb.route('/search/tv')
def search_tv():
    query = request.args.get('query', '')
    results = searchShow(query) if query else []
    return jsonify({'query': query, 'results': results})


@tmdb.route('/search/multi')
def search_multi():
    query = request.args.get('query', '')
    results = searchMulti(query) if query else []
    return jsonify({'query': query, 'results': results})


@tmdb.route('/search/person')
def search_person():
    query = request.args.get('query', '')
    results = searchPerson(query) if query else []
    return jsonify({'query': query, 'results': results})


@tmdb.route('/discover')
def discover():
    return jsonify({'results': discoverTrending()})


@tmdb.route('/movie/<int:movie_id>')
def movie_detail(movie_id):
    result = getMovie(movie_id)
    if not result:
        return jsonify({'error': 'Movie not found'}), 404
    return jsonify(result)


@tmdb.route('/tv/<int:show_id>')
def show_detail(show_id):
    result = getShow(show_id)
    if not result:
        return jsonify({'error': 'Show not found'}), 404
    return jsonify(result)


@tmdb.route('/person/<int:person_id>/credits')
def person_credits(person_id):
    result = getPersonCredits(person_id)
    if not result:
        return jsonify({'error': 'Person not found'}), 404
    return jsonify(result)


@tmdb.route('/tv/<int:show_id>/season/<int:season_number>')
def season_detail(show_id, season_number):
    result = getSeasonDetails(show_id, season_number)
    if not result:
        return jsonify({'error': 'Season not found'}), 404
    return jsonify(result)
