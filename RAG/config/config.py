# config/config.py
import os
from dotenv import load_dotenv

# Load environment variables from a .env file
load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

CHUNK_SIZE_OPENAI = 10000
CHUNK_OVERLAP_OPENAI = 1000

CHUNK_SIZE_OLLAMA = 1200
CHUNK_OVERLAP_OLLAMA = 200
