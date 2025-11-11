import os
from dotenv import load_dotenv

load_dotenv()

# API Keys
CRYPTOPANIC_API_KEY = os.getenv("CRYPTOPANIC_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
