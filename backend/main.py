import os
import shutil
import hashlib
from datetime import datetime, timezone

from fastapi import BackgroundTasks, FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

try:
    from backend.services.analyze import analyze
    from backend.services import store
except ImportError:
    from services.analyze import analyze
    from services import store


app = FastAPI(title="GOODWINSUN Analysis API")

# Allow requests from the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

TEMP_DIR = "temp_audio"
os.makedirs(TEMP_DIR, exist_ok=True)
AUDIO_DIR = os.path.join(os.path.dirname(__file__), "audio")
os.makedirs(AUDIO_DIR, exist_ok=True)
app.mount("/audio", StaticFiles(directory=AUDIO_DIR), name="audio")
store.init_db()


@app.get("/")
async def root():
    return {"status": "ok", "service": "GOODWINSUN Analysis API"}


@app.get("/health")
async def health():
    return {"status": "ok"}


def cleanup_file(filepath: str):
    try:
        if os.path.exists(filepath):
            os.remove(filepath)
    except Exception as e:
        print(f"Error cleaning up file {filepath}: {e}")


@app.post("/api/analyze")
async def analyze_audio(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    safe_name = file.filename or "capture.webm"
    file_path = os.path.join(TEMP_DIR, safe_name)
    audio_ext = ".webm"
    if file.content_type:
        if "wav" in file.content_type:
            audio_ext = ".wav"
        elif "ogg" in file.content_type:
            audio_ext = ".ogg"
        elif "webm" in file.content_type:
            audio_ext = ".webm"

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    with open(file_path, "rb") as buffer:
        raw = buffer.read()

    blob_hash = hashlib.sha256(raw).hexdigest()
    user_filename = file.filename or "capture"
    audio_filename = f"{blob_hash}{audio_ext}"
    audio_path = os.path.join(AUDIO_DIR, audio_filename)

    try:
        with open(audio_path, "wb") as audio_buffer:
            audio_buffer.write(raw)

        analysis_result = analyze(file_path)
        store.insert_node(
            blob_hash=blob_hash,
            label=os.path.splitext(user_filename)[0],
            user_filename=user_filename,
            bpm=analysis_result.get("bpm"),
            key=analysis_result.get("key"),
            mood=analysis_result.get("mood"),
            parents=[],
            created_at=datetime.now(timezone.utc).isoformat(),
        )
    finally:
        background_tasks.add_task(cleanup_file, file_path)

    return {
        "id": blob_hash,
        "blob_hash": blob_hash,
        "user_filename": user_filename,
        "audio_url": f"/audio/{audio_filename}",
        "source_backend": "backend/main.py",
        **analysis_result,
    }


@app.post("/capture")
async def capture_audio(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Compatibility alias so the frontend can call /capture on either backend app."""
    return await analyze_audio(background_tasks=background_tasks, file=file)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
