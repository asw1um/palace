from fastapi import APIRouter, HTTPException, Query

from search import (
    search_movie, search_show, search_multi, search_person,
    get_movie, getShow, get_person_credits, get_season_details,
    discover_trending,
)

router = APIRouter()


@router.get('/search')
async def search(query: str = Query(default='')):
    return {'query': query, 'results': search_movie(query) if query else []}


@router.get('/search/tv')
async def search_tv(query: str = Query(default='')):
    return {'query': query, 'results': search_show(query) if query else []}


@router.get('/search/multi')
async def search_multi_view(query: str = Query(default='')):
    return {'query': query, 'results': search_multi(query) if query else []}


@router.get('/search/person')
async def search_person_view(query: str = Query(default='')):
    return {'query': query, 'results': search_person(query) if query else []}


@router.get('/discover')
async def discover():
    return {'results': discover_trending()}


@router.get('/movie/{movie_id}')
async def movie_detail(movie_id: int):
    result = get_movie(movie_id)
    if not result:
        raise HTTPException(status_code=404, detail='Movie not found')
    return result


@router.get('/tv/{show_id}')
async def show_detail(show_id: int):
    result = getShow(show_id)
    if not result:
        raise HTTPException(status_code=404, detail='Show not found')
    return result


@router.get('/person/{person_id}/credits')
async def person_credits(person_id: int):
    result = get_person_credits(person_id)
    if not result:
        raise HTTPException(status_code=404, detail='Person not found')
    return result


@router.get('/tv/{show_id}/season/{season_number}')
async def season_detail(show_id: int, season_number: int):
    result = get_season_details(show_id, season_number)
    if not result:
        raise HTTPException(status_code=404, detail='Season not found')
    return result
