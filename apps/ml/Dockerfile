FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml /app/
COPY src /app/src

RUN pip install --no-cache-dir .

EXPOSE 8000
CMD ["uvicorn", "desain_ml.main:app", "--host", "0.0.0.0", "--port", "8000"]
