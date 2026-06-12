FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /workspace/backend

COPY backend/requirements.txt ./requirements.txt
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

COPY backend/app ./app
COPY backend/migrations ./migrations
COPY backend/scripts ./scripts

# Auto-run migrations on startup
COPY backend/scripts/start.sh ./start.sh
RUN chmod +x ./start.sh

RUN adduser --disabled-password --gecos "" appuser && \
    chown -R appuser:appuser /workspace/backend
USER appuser

EXPOSE 8000

CMD ["./start.sh"]
