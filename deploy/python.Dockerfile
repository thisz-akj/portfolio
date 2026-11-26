# One image recipe for the Python services. Build from the repo root:
#   docker build -f deploy/python.Dockerfile --build-arg SERVICE=assistant .
# SERVICE = assistant | docintel | voice  (the voice image also runs the LiveKit worker).
FROM python:3.12-slim

ARG SERVICE
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /srv/app
COPY ${SERVICE}/requirements.txt ./requirements.txt
RUN pip install -r requirements.txt

COPY ${SERVICE}/ ./

# Voice: fetch the local speech-detection / end-of-turn models into the image (no download at start-up).
RUN if [ "$SERVICE" = "voice" ]; then python -m agent.worker download-files; fi

RUN useradd --create-home --uid 10001 app && chown -R app /srv/app
USER app
