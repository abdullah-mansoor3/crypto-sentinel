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
