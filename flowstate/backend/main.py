from pathlib import Path
from datetime import datetime, timezone
from shutil import copy2
import wave

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uuid
import os
import json

try:
    # Works when launched from repo root: `python -m uvicorn flowstate.backend.main:app`
    from flowstate.backend.db import execute, commit
    from flowstate.backend.audio_utils import convert_to_wav, extract_audio_features
except ModuleNotFoundError:
    # Works when launched inside backend dir: `python -m uvicorn main:app`
    from db import execute, commit
    from audio_utils import convert_to_wav, extract_audio_features

app = FastAPI()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=False,
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


def _parse_iso_datetime(value: str):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None


def _get_node_row(node_id: str):
    return execute(
        """
        SELECT id, file, bpm, parents, created_at, duration, musical_key, mood
        FROM nodes
        WHERE id = ?
        """,
        (node_id,),
    ).fetchone()


def _copy_wav_file(source_path: Path, destination_path: Path):
    copy2(source_path, destination_path)


def _merge_wav_files(left_path: Path, right_path: Path, output_path: Path):
    with wave.open(str(left_path), "rb") as left_wav, wave.open(str(right_path), "rb") as right_wav:
        if (
            left_wav.getnchannels() != right_wav.getnchannels()
            or left_wav.getsampwidth() != right_wav.getsampwidth()
            or left_wav.getframerate() != right_wav.getframerate()
        ):
            raise HTTPException(status_code=400, detail="WAV files must share the same audio format to merge")

        with wave.open(str(output_path), "wb") as merged_wav:
            merged_wav.setnchannels(left_wav.getnchannels())
            merged_wav.setsampwidth(left_wav.getsampwidth())
            merged_wav.setframerate(left_wav.getframerate())
            merged_wav.writeframes(left_wav.readframes(left_wav.getnframes()))
            merged_wav.writeframes(right_wav.readframes(right_wav.getnframes()))


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

    # Only treat the upload as WAV when the bytes are actually a RIFF/WAVE file.
    # Browsers often label MediaRecorder WebM uploads as audio/wav if the filename ends in .wav,
    # which would corrupt the saved file if we trusted content-type.
    is_wav = len(raw) >= 12 and raw[0:4] == b'RIFF' and raw[8:12] == b'WAVE'

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
        except RuntimeError as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Audio conversion failed: {exc}",
            ) from exc
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Audio conversion failed unexpectedly: {exc}",
            ) from exc

        if webm_path.exists():
            os.remove(webm_path)

    # Extract audio features for analysis and display.
    try:
        features = extract_audio_features(str(wav_path))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Feature extraction failed: {exc}") from exc
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

    try:
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
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database write failed: {exc}") from exc

    return {
        "id": uid,
        "bpm": bpm,
        "duration": duration,
        "musical_key": musical_key,
        "mood": mood,
        "created_at": created_at,
    }


@app.post("/fork/{node_id}")
def fork_node(node_id: str):
    row = _get_node_row(node_id)
    if not row:
        raise HTTPException(status_code=404, detail="Node not found")

    source_file = row[1] or ""
    if not source_file:
        raise HTTPException(status_code=400, detail="Node has no audio file to fork")

    source_path = AUDIO_DIR / Path(source_file).name
    if not source_path.exists():
        raise HTTPException(status_code=404, detail="Source audio file not found")

    new_id = str(uuid.uuid4())
    new_path = AUDIO_DIR / f"{new_id}.wav"
    _copy_wav_file(source_path, new_path)

    created_at = datetime.now(timezone.utc).isoformat()
    execute(
        """
        INSERT INTO nodes (id, file, bpm, parents, created_at, duration, musical_key, mood)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            new_id,
            f"audio/{new_id}.wav",
            row[2],
            json.dumps([node_id]),
            created_at,
            row[5] or 0.0,
            row[6] or "Unknown",
            row[7] or "neutral",
        ),
    )
    commit()
    return {"id": new_id, "source_id": node_id}


@app.post("/merge/{left_id}/{right_id}")
def merge_nodes(left_id: str, right_id: str):
    left_row = _get_node_row(left_id)
    right_row = _get_node_row(right_id)
    if not left_row or not right_row:
        raise HTTPException(status_code=404, detail="One or both nodes not found")

    left_file = left_row[1] or ""
    right_file = right_row[1] or ""
    if not left_file or not right_file:
        raise HTTPException(status_code=400, detail="Both nodes need audio files to merge")

    left_path = AUDIO_DIR / Path(left_file).name
    right_path = AUDIO_DIR / Path(right_file).name
    if not left_path.exists() or not right_path.exists():
        raise HTTPException(status_code=404, detail="One or both source audio files are missing")

    new_id = str(uuid.uuid4())
    merged_path = AUDIO_DIR / f"{new_id}.wav"
    _merge_wav_files(left_path, right_path, merged_path)

    features = extract_audio_features(str(merged_path))
    created_at = datetime.now(timezone.utc).isoformat()

    execute(
        """
        INSERT INTO nodes (id, file, bpm, parents, created_at, duration, musical_key, mood)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            new_id,
            f"audio/{new_id}.wav",
            features["bpm"],
            json.dumps([left_id, right_id]),
            created_at,
            features["duration"],
            features["musical_key"],
            features["mood"],
        ),
    )
    commit()
    return {"id": new_id, "left_id": left_id, "right_id": right_id}


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
    child_row = _get_node_row(child_id)
    parent_row = _get_node_row(parent_id)
    if not child_row or not parent_row:
        return {"success": False, "message": "Connection failed"}

    child_created_at = _parse_iso_datetime(child_row[4])
    parent_created_at = _parse_iso_datetime(parent_row[4])
    if child_created_at and parent_created_at and parent_created_at > child_created_at:
        return {
            "success": False,
            "message": "Parent is newer than child. Fork the newer node first, then connect to the fork.",
            "needsFork": True,
        }

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
