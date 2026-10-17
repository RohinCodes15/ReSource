# The ReSource API. Build from the repository root: the API reads shared/data.
#   docker build -t resource-api .
#   docker run -p 8000:8000 resource-api
# With no environment variables it runs in local mode: bundled data, no accounts.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 LOCAL_STATE_DIR=/data
WORKDIR /srv

COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend backend
COPY shared/data shared/data

# Do not run as root. /data holds what people submit in local mode.
RUN useradd --create-home --uid 10001 app && mkdir /data && chown app /data
USER app
WORKDIR /srv/backend
EXPOSE 8000

# One worker: rate limits and chat sessions are kept in this process's memory.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
