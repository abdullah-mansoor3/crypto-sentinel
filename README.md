# Crypto Sentinel

This repository contains a FastAPI backend and a Next.js frontend for the Crypto Sentinel project.

## Requirements

- Python 3.11+
- Node 18+ / npm
- (for Docker) Docker Engine

## Environment

Create a `.env` file in `backend/` with any API keys required. Example:

```
CRYPTOPANIC_API_KEY=your_key_here
GROQ_API_KEY=your_key_here
```

The backend loads environment variables with python-dotenv.

## Run backend locally

1. Create and activate a virtual environment:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
```

2. Install Python dependencies:

```bash
pip install -r requirements.txt
```

3. Run the backend (from the `backend` directory):

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

- The backend serves APIs under `/api` (for example `http://localhost:8000/api/technical`).
- The backend also serves a simple static frontend located at `/frontend` and the root `/` serves `frontend/index.html`.

## Run frontend locally (Next.js)

1. Install dependencies and run the dev server:

```bash
cd frontend
npm install
npm run dev
```

2. By default, Next runs on port 3000. If you want the frontend to talk to the backend running on 8000, either:

- Use relative API paths (e.g. `/api/...`) when serving the frontend from the same origin as the backend.
- Or run the frontend on a different host/port and enable CORS on the backend.

To build a production-ready frontend bundle:

```bash
npm run build
npm run start
```

> Note: The repository contains a small static `frontend/index.html` (an API-tester) at the project root `frontend/index.html` which is also served by the backend at `/`.

## Build and run with Docker

The provided Dockerfile builds the frontend, installs backend dependencies, and runs the FastAPI app with Uvicorn.

Build the image from the repo root:

```bash
docker build -f docker/Dockerfile -t crypto-sentinel:latest .
```

Run the container:

```bash
docker run --env-file backend/.env -p 8000:8000 crypto-sentinel:latest
```

- The container exposes port 8000. The backend will look for the frontend at `/app/frontend` (this Dockerfile ensures the built frontend is copied into `/app/frontend`).
- If you don't have a `.env`, you can pass environment variables with `-e VAR=VALUE`.

## Notes & Troubleshooting

- `main.py` changes the working directory to the project root (two levels up from `main.py`) to make relative imports and static serving work. That is: when running inside the container the backend expects the frontend at `/app/frontend`.

- If the backend raises an error about the frontend directory missing, ensure you built the Docker image with the Dockerfile in `docker/` (the Dockerfile copies the built frontend into `/app/frontend`).

- CORS: If you run the frontend separately (dev server on 3000) the backend will need CORS enabled to accept requests from that origin. You can enable CORS in `backend/main.py` using `fastapi.middleware.cors.CORSMiddleware`.

- To debug inside the container, use `docker run -it --entrypoint /bin/bash crypto-sentinel:latest`.
