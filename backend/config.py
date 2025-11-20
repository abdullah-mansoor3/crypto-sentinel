import os
from dotenv import load_dotenv

load_dotenv()

# API Keys
CRYPTOPANIC_API_KEY = os.getenv("CRYPTOPANIC_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
# Embeddings toggle (set to '1' or 'true' to enable embedding model downloads/use)
EMBEDDINGS_ENABLED = str(os.getenv("EMBEDDINGS_ENABLED", "0")).lower() in ("1", "true", "yes")
