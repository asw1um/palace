from datetime import datetime

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
