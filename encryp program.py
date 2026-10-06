import os
from dotenv import load_dotenv

load_dotenv()

key = os.getenv("ANTHROPIC_API_KEY")

print("Loaded:", bool(key))
print("Length:", len(key) if key else 0)
print("First characters:", key[:10] if key else None)