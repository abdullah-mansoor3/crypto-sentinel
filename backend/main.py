from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
import os

# ensure working dir is project root so relative "frontend" references from other modules resolve
project_root = Path(__file__).resolve().parent.parent
os.chdir(project_root)

# import routes after changing cwd so their StaticFiles(... "frontend") can find the directory
from routes import market, technical, agents

app = FastAPI()

# use absolute path to the frontend folder
frontend_dir = project_root / "frontend"
if not frontend_dir.exists():
	# helpful error if frontend is missing
	raise RuntimeError(f"Frontend directory does not exist at: {frontend_dir}")

# Mount frontend static files at a safe URL path
app.mount("/frontend", StaticFiles(directory=str(frontend_dir)), name="frontend")

# Include API routes
app.include_router(market.router, prefix="/api")
app.include_router(technical.router, prefix="/api")
app.include_router(agents.router, prefix="/api")

# Serve frontend index
@app.get("/")
def serve_frontend():
	return FileResponse(str(frontend_dir / "index.html"))
