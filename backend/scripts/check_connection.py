"""Connectivity check: can this machine reach the configured MongoDB, and what is in it? Read-only.

Usage (from backend/):  python -m scripts.check_connection
"""
import sys
import time

from pymongo import MongoClient
from pymongo.errors import PyMongoError

from app.core.config import get_settings


def main() -> int:
    s = get_settings()
    target = s.mongodb_uri.split("@")[-1] if "@" in s.mongodb_uri else s.mongodb_uri  # never print the credentials
    print(f"Connecting to {target} (database '{s.mongodb_db_name}') ...")
    started = time.time()
    try:
        client = MongoClient(s.mongodb_uri, serverSelectionTimeoutMS=15000)
        db = client[s.mongodb_db_name]
        names = sorted(db.list_collection_names())
    except PyMongoError as exc:
        print(f"\nCould NOT connect after {time.time() - started:.0f}s: {type(exc).__name__}")
        print("Check: the VPN is connected, your IP is allowed in Atlas > Network Access, and MONGODB_URI is right.")
        return 1
    print(f"Connected in {time.time() - started:.1f}s. The database has {len(names)} collections.")
    for n in names:
        print(f"  {n:32} {db[n].estimated_document_count()} documents")
    if "tenants" in names and db["tenants"].estimated_document_count():
        print("\nThis database already has schools in it: do NOT run seed_sample_data; log in with the existing accounts.")
    else:
        print("\nNo schools yet: run seed-demo-data.bat to create the demo school.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
