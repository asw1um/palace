# build from repo root: docker build -f backend/Dockerfile .
FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY backend/ ./backend/

# db + uploads live in instance, mounted as a volume
RUN useradd --system --uid 10001 --home-dir /app palace \
    && mkdir -p /app/backend/instance/uploads \
    && chown -R palace:palace /app/backend/instance
VOLUME /app/backend/instance

USER palace
WORKDIR /app/backend
EXPOSE 5000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:5000/api/', timeout=4).status == 200 else 1)"

# keep 1 worker, the lists cache is in memory
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5000", "--proxy-headers", "--forwarded-allow-ips", "*"]
