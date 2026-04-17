"""
main.py — FastAPI entry point
Initializes DB on startup, mounts static blob serving, registers route modules.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from services.store import init_db

app = FastAPI(title="FlowState API", version="0.1.0")

# ── CORS (Next.js dev server runs on 3000) ──────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static blob serving ─────────────────────────────────────────────────────
BLOBS_DIR = os.path.join(os.path.dirname(__file__), "assets", "blobs")
os.makedirs(BLOBS_DIR, exist_ok=True)
app.mount("/blobs", StaticFiles(directory=BLOBS_DIR), name="blobs")
# Audio clips fetchable at: GET /blobs/{sha256}.wav

# ── Startup: init database ──────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    init_db()
    print("✓ Database initialized")
    print(f"✓ Blob store at {BLOBS_DIR}")


# ── Health check ────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok"}


# ── Routes (uncomment as each is built) ─────────────────────────────────────
# from routes.capture import router as capture_router
# from routes.branch  import router as branch_router
# from routes.merge   import router as merge_router
# from routes.graph   import router as graph_router
# from routes.search  import router as search_router

# app.include_router(capture_router)
# app.include_router(branch_router)
# app.include_router(merge_router)
# app.include_router(graph_router)
# app.include_router(search_router)