import os
from dotenv import load_dotenv

load_dotenv()

# API Keys
CRYPTOPANIC_API_KEY = os.getenv("CRYPTOPANIC_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
# Embeddings toggle (set to '1' or 'true' to enable embedding model downloads/use; default: disabled)
EMBEDDINGS_ENABLED = str(os.getenv("EMBEDDINGS_ENABLED", "0")).lower() in ("1", "true", "yes")

# Cache directories for Chroma and Hugging Face models (persist across restarts)
CACHE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".cache"))
os.makedirs(CACHE_DIR, exist_ok=True)
# Set environment variables for persistent caching to avoid re-downloading models
os.environ.setdefault("HF_HOME", os.path.join(CACHE_DIR, "huggingface"))
os.environ.setdefault("CHROMA_CACHE_DIR", os.path.join(CACHE_DIR, "chroma_models"))

# -----------------------------------------------------------------------------
# Cache TTL thresholds (in seconds unless noted)
# -----------------------------------------------------------------------------
# Market OHLCV cache TTL (CoinGecko disk cache freshness threshold)
MARKET_CACHE_TTL_SECONDS = int(os.getenv("MARKET_CACHE_TTL_SECONDS", 3600))  # 1 hour

# Technical indicators cache TTL
TECHNICAL_CACHE_TTL_SECONDS = int(os.getenv("TECHNICAL_CACHE_TTL_SECONDS", 600))  # 10 minutes

# News staleness threshold (hours)
NEWS_STALE_HOURS = int(os.getenv("NEWS_STALE_HOURS", 6))

# News pruning interval (days)
NEWS_PRUNE_DAYS = int(os.getenv("NEWS_PRUNE_DAYS", 30))
