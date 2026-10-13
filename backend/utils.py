from datetime import datetime

from fastapi import HTTPException

MAX_IMAGE_BYTES = 5 * 1024 * 1024

_TIME_UNITS = [
    (2592000, "mo"),
    (604800,  "w"),
    (86400,   "d"),
    (3600,    "h"),
    (60,      "m"),
]

def time_ago(created_at):
    if not created_at:
        return "unknown"
    seconds = int((datetime.utcnow() - created_at).total_seconds())
    if seconds < 60:
        return "just now"
    for divisor, unit in _TIME_UNITS:
        if seconds >= divisor:
            return f"{seconds // divisor}{unit}"


def image_ext(data):
    # go off the file contents, the filename can say anything
    if data[:8] == b'\x89PNG\r\n\x1a\n':
        return 'png'
    if data[:3] == b'\xff\xd8\xff':
        return 'jpg'
    if data[:6] in (b'GIF87a', b'GIF89a'):
        return 'gif'
    if data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        return 'webp'
    return None


async def read_image(file):
    data = await file.read(MAX_IMAGE_BYTES + 1)
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail='Image must be 5MB or smaller')
    ext = image_ext(data)
    if not ext:
        raise HTTPException(status_code=400, detail='Invalid file type')
    return data, ext
