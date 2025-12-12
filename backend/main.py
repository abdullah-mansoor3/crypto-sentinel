from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
import os
import logging
from contextlib import asynccontextmanager

# ensure working dir is project root so relative "frontend" references from other modules resolve
project_root = Path(__file__).resolve().parent.parent
os.chdir(project_root)

# import routes after changing cwd so their StaticFiles(... "frontend") can find the directory
from routes import market, technical, agents, quant, about
from data.fetch_market import fetch_ohlcv_data
from data.fetch_news import start_prune_scheduler
from utils import cache as cache_utils
import asyncio

logger = logging.getLogger("crypto-sentinel")


@asynccontextmanager
async def lifespan(app: FastAPI):
	"""Lifespan context manager for startup and shutdown events."""
	# Startup: download embedding models, preload market data, start schedulers
	await download_embedding_models_if_needed()
	await preload_market_data()
	# Start news pruning scheduler (runs daily in background)
	try:
		start_prune_scheduler(interval_hours=24)
		logger.info("News pruning scheduler started")
	except Exception as e:
		logger.warning("Failed to start news pruning scheduler: %s", e)
	yield
	# Shutdown: cleanup if needed
	pass


app = FastAPI(lifespan=lifespan)

# During local development allow the Next.js dev server to call the API
app.add_middleware(
	CORSMiddleware,
	allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:8000"],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)

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
app.include_router(quant.router, prefix="/api")
app.include_router(agents.router, prefix="/api/agents")
app.include_router(about.router, prefix="/api")


async def download_embedding_models_if_needed():
	"""Download embedding models on first startup if EMBEDDINGS_ENABLED is true."""
	try:
		from config import EMBEDDINGS_ENABLED, CACHE_DIR
		import os
		
		if not EMBEDDINGS_ENABLED:
			logger.info("Embeddings disabled; skipping model download")
			return
		
		# Check if model is already cached
		hf_home = os.environ.get("HF_HOME", os.path.join(CACHE_DIR, "huggingface"))
		model_path = os.path.join(hf_home, "hub", "models--sentence-transformers--all-MiniLM-L6-v2")
		
		if os.path.exists(model_path):
			logger.info("Embedding model already cached; skipping download")
			return
		
		logger.info("Downloading embedding model (all-MiniLM-L6-v2) on first startup...")
		loop = asyncio.get_event_loop()
		
		def load_model():
			from chromadb.utils import embedding_functions
			emb = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")
			# Test the model by calling __call__ which is the embedding method
			test = emb(["test"])
			logger.info(f"Embedding model loaded successfully (dimension: {len(test[0])})")
			return emb
		
		await loop.run_in_executor(None, load_model)
		logger.info("Embedding model download complete")
	except Exception as e:
		logger.exception(f"Failed to download embedding models: {e}")
		# Don't block startup if model download fails


async def preload_market_data():
	"""Preload OHLCV for BTC and ETH into the in-memory cache on startup."""
	try:
		# run concurrently
		loop = asyncio.get_event_loop()
		tasks = [
			loop.run_in_executor(None, fetch_ohlcv_data, "bitcoin", "usd", 90, "daily"),
			loop.run_in_executor(None, fetch_ohlcv_data, "ethereum", "usd", 90, "daily"),
		]
		results = await asyncio.gather(*tasks)
		if isinstance(results[0], dict) and results[0].get("error"):
			# skip caching if error
			pass
		else:
			cache_utils.set("BTC", results[0])
		if isinstance(results[1], dict) and results[1].get("error"):
			pass
		else:
			cache_utils.set("ETH", results[1])
	except Exception:
		# don't block startup on cache failures
		pass

# Serve frontend index
@app.get("/")
def serve_frontend():
	return FileResponse(str(frontend_dir / "index.html"))
