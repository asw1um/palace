import os
import requests
from dotenv import load_dotenv
from cache import cache_get, cache_set, cache_flush, cache_flush_expired
from gamble import get_api_key

load_dotenv()
base_url = "https://api.themoviedb.org/3"
image_base_url = "https://image.tmdb.org/t/p"
poster_size = "w500"
backdrop_size = "w1280"
profile_size = "h632"


def get_poster_url(poster_path):
    if poster_path:
        return f"{image_base_url}/{poster_size}{poster_path}"
    return None


def get_backdrop_url(backdrop_path):
    if backdrop_path:
        return f"{image_base_url}/{backdrop_size}{backdrop_path}"
    return None


def get_profile_url(profile_path):
    if profile_path:
        return f"{image_base_url}/{profile_size}{profile_path}"
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


def _tmdb_request(url, extra_params=None):
    params = {"api_key": get_api_key(), "language": "en-US"}
    if extra_params:
        params.update(extra_params)
    response = requests.get(url, params=params, timeout=10)
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
            'profile_url': get_profile_url(c.get('profile_path')),
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


def format_multi(item):
    media_type = item.get('media_type')
    base = {
        'id': item.get('id'),
        'media_type': media_type,
        'title': item.get('title') or item.get('name'),
        'overview': item.get('overview'),
        'poster_url': get_poster_url(item.get('poster_path')),
        'backdrop_url': get_backdrop_url(item.get('backdrop_path')),
        'release_date': item.get('release_date') or item.get('first_air_date'),
        'rating': item.get('vote_average'),
        'popularity': item.get('popularity'),
        'genre_ids': item.get('genre_ids', [])
    }
    if media_type == 'tv':
        base['number_of_seasons'] = item.get('number_of_seasons')
    return base


def format_movie(movie):
    result = format_multi(movie)
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


def format_show(show_data):
    result = format_multi(show_data)
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
        {'id': c.get('id'), 'name': c.get('name'), 'profile_url': get_profile_url(c.get('profile_path'))}
        for c in show_data.get('created_by', [])
    ]
    result['cast'] = _format_cast(show_data.get('credits'))
    result['trailer_key'] = _format_trailer(show_data.get('videos'))
    result['tmdb_url'] = f"https://www.themoviedb.org/tv/{show_data.get('id')}"
    return result


def _search(endpoint, query):
    data = _cached_tmdb_request(f"{base_url}/{endpoint}", {"query": query, "page": 1}, ttl_hours=_TTL_SEARCH)
    if data:
        return data.get("results", [])
    return []


def search_movie(query):
    return [format_movie(m) for m in _search("search/movie", query)]


def search_show(query):
    return [format_show(s) for s in _search("search/tv", query)]


def search_multi(query):
    data = _cached_tmdb_request(f"{base_url}/search/multi", {"query": query, "page": 1}, ttl_hours=_TTL_SEARCH)
    if not data:
        return []
    results = [
        format_multi(item)
        for item in data.get("results", [])
        if item.get('media_type') in ('movie', 'tv')
    ]
    results.sort(key=lambda x: x.get('popularity') or 0, reverse=True)
    return results


_APPEND = "credits,videos,similar,recommendations,images,watch/providers"


def get_movie(movie_id):
    data = _cached_tmdb_request(
        f"{base_url}/movie/{movie_id}",
        {"append_to_response": _APPEND},
        ttl_hours=_TTL_FOREVER,
    )
    return format_movie(data) if data else None


def getShow(show_id):
    url = f"{base_url}/tv/{show_id}"
    params = {"append_to_response": _APPEND}
    key = _cache_key(url, params)

    data = cache_get(key)
    if data is None:
        data = _tmdb_request(url, params)
        if data and data.get('status') in _ENDED_STATUSES:
            cache_set(key, data, ttl_hours=_TTL_FOREVER)

    if not data:
        return None
    result = format_show(data)
    result['seasons'] = [
        {'season_number': s.get('season_number'), 'episode_count': s.get('episode_count')}
        for s in data.get('seasons', [])
        if s.get('episode_count', 0) > 0
    ]
    return result


def get_season_details(show_id, season_number):
    data = _cached_tmdb_request(f"{base_url}/tv/{show_id}/season/{season_number}", ttl_hours=_TTL_SEASON)
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
                'still_url': get_poster_url(ep.get('still_path')) if ep.get('still_path') else None,
            }
            for ep in data.get('episodes', [])
        ]
    }


_MIN_PERSON_POPULARITY = 1.0

def search_person(query):
    data = _cached_tmdb_request(f"{base_url}/search/person", {"query": query, "page": 1}, ttl_hours=_TTL_SEARCH)
    if not data:
        return []
    results = []
    candidates = [p for p in data.get("results", []) if p.get('popularity', 0) >= _MIN_PERSON_POPULARITY]
    for p in candidates[:12]:
        results.append({
            'id': p.get('id'),
            'name': p.get('name'),
            'profile_url': get_profile_url(p.get('profile_path')),
            'department': p.get('known_for_department', ''),
            'popularity': p.get('popularity', 0),
            'known_for': [
                {
                    'id': k.get('id'),
                    'title': k.get('title') or k.get('name'),
                    'media_type': k.get('media_type'),
                    'poster_url': get_poster_url(k.get('poster_path')),
                }
                for k in p.get('known_for', [])[:3]
            ]
        })
    return results


def get_person_credits(person_id):
    # single request: person details + combined_credits to append_to_response (less http requests)
    data = _cached_tmdb_request(
        f"{base_url}/person/{person_id}",
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
            'poster_url': get_poster_url(entry.get('poster_path')),
            'release_date': entry.get('release_date') or entry.get('first_air_date') or '',
            'rating': entry.get('vote_average'),
            'popularity': entry.get('popularity', 0),
            'role': role,
        })

    items.sort(key=lambda x: x.get('popularity') or 0, reverse=True)

    return {
        'id': person_id,
        'name': data.get('name', ''),
        'profile_url': get_profile_url(data.get('profile_path')),
        'department': data.get('known_for_department', ''),
        'biography': data.get('biography', ''),
        'credits': items,
    }


def discover_trending():
    data = _cached_tmdb_request(f"{base_url}/trending/all/week", {"page": 1}, ttl_hours=_TTL_POPULAR)
    if not data:
        return []
    results = []
    for item in data.get("results", []):
        mt = item.get('media_type')
        if mt == 'movie':
            results.append(format_movie(item))
        elif mt == 'tv':
            results.append(format_show(item))
    return results


def discover_popular_movies():
    data = _cached_tmdb_request(f"{base_url}/movie/popular", {"page": 1}, ttl_hours=_TTL_POPULAR)
    if not data:
        return []
    return [format_movie(m) for m in data.get("results", [])]


def discover_popular_shows():
    data = _cached_tmdb_request(f"{base_url}/tv/popular", {"page": 1}, ttl_hours=_TTL_POPULAR)
    if not data:
        return []
    return [format_show(s) for s in data.get("results", [])]
    