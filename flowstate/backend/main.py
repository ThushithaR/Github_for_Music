from fastapi import FastAPI, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uuid
import os
import json

from db import cursor, conn
from audio_utils import convert_to_wav, extract_bpm

app = FastAPI()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

AUDIO_DIR = "audio"
os.makedirs(AUDIO_DIR, exist_ok=True)

app.mount("/audio", StaticFiles(directory="audio"), name="audio")


@app.post("/capture")
async def capture(file: UploadFile = File(...)):
    uid = str(uuid.uuid4())

    webm_path = f"{AUDIO_DIR}/{uid}.webm"
    wav_path = f"{AUDIO_DIR}/{uid}.wav"

    # Save uploaded file
    with open(webm_path, "wb") as f:
        f.write(await file.read())

    # Convert to wav
    convert_to_wav(webm_path, wav_path)

    # Extract BPM
    bpm = extract_bpm(wav_path)

    # Store in DB
    cursor.execute("""
        INSERT INTO nodes VALUES (?, ?, ?, ?)
    """, (uid, wav_path, bpm, json.dumps([])))

    conn.commit()

    return {"id": uid, "bpm": bpm}


@app.get("/nodes")
def get_nodes():
    rows = cursor.execute("SELECT * FROM nodes").fetchall()

    result = []
    for r in rows:
        result.append({
            "id": r[0],
            "file": r[1],
            "bpm": r[2],
            "parents": json.loads(r[3])
        })

    return result


@app.post("/branch/{parent_id}")
def branch(parent_id: str):
    uid = str(uuid.uuid4())

    cursor.execute("""
        INSERT INTO nodes VALUES (?, ?, ?, ?)
    """, (uid, "", 0, json.dumps([parent_id])))

    conn.commit()

    return {"id": uid}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
