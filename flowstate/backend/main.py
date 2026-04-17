from pathlib import Path
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uuid
import os
import json

from db import execute, commit
from audio_utils import convert_to_wav, extract_audio_features

app = FastAPI()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
AUDIO_DIR = BASE_DIR / "audio"
AUDIO_ASSETS_DIR = BASE_DIR / "assets"
AUDIO_DIR.mkdir(parents=True, exist_ok=True)
AUDIO_ASSETS_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/audio", StaticFiles(directory=str(AUDIO_DIR)), name="audio")
app.mount("/assets", StaticFiles(directory=str(AUDIO_ASSETS_DIR)), name="assets")


@app.get("/")
def root():
    return {
        "app": "FlowState Audio Recorder",
        "endpoints": {
            "recorder": "GET /recorder - Open the recorder UI",
            "capture": "POST /capture - Upload audio file",
            "nodes": "GET /nodes - List all recorded clips",
            "reanalyze": "POST /nodes/reanalyze-features - Recompute BPM/key/mood for existing clips",
            "health": "GET /health - Check backend health",
        },
    }


@app.get("/health")
def health():
    return {
        "ok": True,
        "db": str((BASE_DIR / "database.db")),
        "audio_dir": str(AUDIO_DIR),
    }


@app.get("/capture")
def capture_help():
    return {
        "detail": "Use POST /capture with multipart form-data field named 'file'.",
        "example_curl": "curl.exe -X POST -F \"file=@my_recording.wav;type=audio/wav\" http://127.0.0.1:8000/capture",
    }


@app.get("/recorder")
def recorder_page():
    return FileResponse(str(AUDIO_ASSETS_DIR / "recorder.html"))


@app.post("/capture")
async def capture(file: UploadFile = File(...), parent_id: str = None):
    uid = str(uuid.uuid4())

    webm_path = AUDIO_DIR / f"{uid}.webm"
    wav_path = AUDIO_DIR / f"{uid}.wav"
    raw = await file.read()

    if not raw:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    # Check if file is WAV by looking at RIFF header or content-type
    is_wav = False
    
    # Check RIFF header (WAV files start with "RIFF" followed by size, then "WAVE")
    if len(raw) >= 12 and raw[0:4] == b'RIFF' and raw[8:12] == b'WAVE':
        is_wav = True
    
    # Also check content-type as fallback
    content_type = (file.content_type or "").lower()
    if content_type in {"audio/wav", "audio/wave", "audio/x-wav"}:
        is_wav = True

    if is_wav:
        # Already WAV, no ffmpeg conversion required.
        with open(wav_path, "wb") as f:
            f.write(raw)
    else:
        # Treat all non-WAV uploads as webm and convert.
        with open(webm_path, "wb") as f:
            f.write(raw)

        try:
            convert_to_wav(str(webm_path), str(wav_path))
        except FileNotFoundError as exc:
            raise HTTPException(
                status_code=500,
                detail="FFmpeg not found in PATH. Install FFmpeg or upload audio/wav.",
            ) from exc

        if webm_path.exists():
            os.remove(webm_path)

    # Extract audio features for analysis and display.
    features = extract_audio_features(str(wav_path))
    bpm = features["bpm"]
    duration = features["duration"]
    musical_key = features["musical_key"]
    mood = features["mood"]
    created_at = datetime.now(timezone.utc).isoformat()

    parents = []
    if parent_id is not None:
        parents = [parent_id]

    # Store relative path for the file instead of absolute path
    relative_file_path = f"audio/{uid}.wav"

    execute(
        """
        INSERT INTO nodes (id, file, bpm, parents, created_at, duration, musical_key, mood)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            uid,
            relative_file_path,
            bpm,
            json.dumps(parents),
            created_at,
            duration,
            musical_key,
            mood,
        ),
    )

    commit()

    return {
        "id": uid,
        "bpm": bpm,
        "duration": duration,
        "musical_key": musical_key,
        "mood": mood,
        "created_at": created_at,
    }


@app.get("/nodes")
def get_nodes():
    rows = execute(
        """
        SELECT id, file, bpm, parents, created_at, duration, musical_key, mood
        FROM nodes
        ORDER BY datetime(created_at) DESC, id DESC
        """
    ).fetchall()

    result = []
    for r in rows:
        file_path = r[1] or ""
        if file_path:
            file_name = Path(file_path).name
            if not (AUDIO_DIR / file_name).exists():
                file_path = ""

        result.append({
            "id": r[0],
            "file": file_path,
            "bpm": r[2],
            "parents": json.loads(r[3]) if r[3] else [],
            "created_at": r[4],
            "duration": r[5] or 0.0,
            "musical_key": r[6] or "Unknown",
            "mood": r[7] or "neutral",
        })

    return result


@app.delete("/nodes/{node_id}")
def delete_node(node_id: str):
    row = execute("SELECT file FROM nodes WHERE id = ?", (node_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Node not found")

    file_value = row[0] or ""
    if file_value:
        file_name = Path(file_value).name
        wav_path = AUDIO_DIR / file_name
        if wav_path.exists():
            wav_path.unlink()

    execute("DELETE FROM nodes WHERE id = ?", (node_id,))
    commit()

    return {"success": True, "id": node_id}


@app.post("/nodes/reanalyze-features")
def reanalyze_node_features():
    rows = execute("SELECT id, file FROM nodes").fetchall()
    updated = 0
    skipped_missing_file = 0

    for node_id, file_value in rows:
        file_value = file_value or ""
        if not file_value:
            continue

        wav_path = AUDIO_DIR / Path(file_value).name
        if not wav_path.exists():
            skipped_missing_file += 1
            continue

        features = extract_audio_features(str(wav_path))
        execute(
            """
            UPDATE nodes
            SET bpm = ?, duration = ?, musical_key = ?, mood = ?
            WHERE id = ?
            """,
            (
                features["bpm"],
                features["duration"],
                features["musical_key"],
                features["mood"],
                node_id,
            ),
        )
        updated += 1

    commit()
    return {
        "updated": updated,
        "skipped_missing_file": skipped_missing_file,
    }


@app.post("/branch/{parent_id}")
def branch(parent_id: str):
    uid = str(uuid.uuid4())

    created_at = datetime.now(timezone.utc).isoformat()

    execute(
        """
        INSERT INTO nodes (id, file, bpm, parents, created_at, duration, musical_key, mood)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (uid, "", 0.0, json.dumps([parent_id]), created_at, 0.0, "Unknown", "neutral"),
    )

    commit()

    return {"id": uid}


@app.post("/connect/{child_id}/{parent_id}")
def connect_nodes(child_id: str, parent_id: str):
    # Get current parents of the child node
    result = execute("SELECT parents FROM nodes WHERE id = ?", (child_id,)).fetchone()
    
    if result:
        current_parents = json.loads(result[0])
        if parent_id not in current_parents:
            current_parents.append(parent_id)
            execute("""
                UPDATE nodes SET parents = ? WHERE id = ?
            """, (json.dumps(current_parents), child_id))
            commit()
            return {"success": True, "message": f"Connected {child_id} to {parent_id}"}
    
    return {"success": False, "message": "Connection failed"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
