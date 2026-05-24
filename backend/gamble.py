import os
import random
from dotenv import load_dotenv

load_dotenv()

def _load_keys():
    # in env, please seperate keys by commas
    # 1 key works just incase
    multi = os.getenv('TMDB_API_KEYS', '')
    if multi.strip():
        return [k.strip() for k in multi.split(',') if k.strip()]
    single = os.getenv('TMDB_API_KEY', '')
    return [single] if single else []

_keys = _load_keys()

def get_api_key() -> str:
    if not _keys:
        raise RuntimeError("No TMBD API key in .env")
    return random.choice(_keys)
