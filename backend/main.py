from pathlib import Path
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

try:
	from backend.services.audio import convert_to_wav, hash_audio, save_blob
	from backend.services.store import get_all_nodes, init_db, insert_node
except ModuleNotFoundError:
	# Fallback for running from within the backend directory.
	from services.audio import convert_to_wav, hash_audio, save_blob
	from services.store import get_all_nodes, init_db, insert_node

@asynccontextmanager
async def lifespan(_: FastAPI):
	init_db()
	yield


app = FastAPI(title="Github for Music API", lifespan=lifespan)

app.add_middleware(
	CORSMiddleware,
	allow_origins=["*"],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)

ASSETS_DIR = Path(__file__).parent / "assets"
app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")


@app.get("/health")
def health() -> dict:
	return {"ok": True}


@app.get("/api/nodes/recent")
def recent_nodes(limit: int = Query(default=10, ge=1, le=100)) -> dict:
	nodes = get_all_nodes()
	latest = list(reversed(nodes))[:limit]
	return {"count": len(latest), "nodes": latest}


@app.post("/api/audio/upload")
async def upload_audio(
	file: UploadFile = File(...),
	label: str = Form(default=""),
	bpm: str = Form(default=""),
	key: str = Form(default=""),
	mood: str = Form(default=""),
) -> dict:
	raw = await file.read()
	if not raw:
		raise HTTPException(status_code=400, detail="Uploaded file is empty")

	content_type = (file.content_type or "").lower()

	if content_type in {"audio/wav", "audio/wave", "audio/x-wav"}:
		wav_bytes = raw
	elif content_type.startswith("audio/webm"):
		wav_bytes = convert_to_wav(raw)
	else:
		raise HTTPException(
			status_code=415,
			detail=(
				"Unsupported file type. Send audio/wav or audio/webm. "
				f"Received: {content_type or 'unknown'}"
			),
		)

	blob_hash = hash_audio(wav_bytes)
	path = save_blob(blob_hash, wav_bytes)
	node_id = str(uuid4())
	created_at = datetime.now(timezone.utc).isoformat()
	parsed_bpm = None

	if bpm.strip():
		try:
			parsed_bpm = float(bpm)
		except ValueError as exc:
			raise HTTPException(status_code=422, detail="bpm must be a number") from exc

	insert_node(
		id=node_id,
		blob_hash=blob_hash,
		label=label.strip() or "Recorded clip",
		bpm=parsed_bpm,
		key=key.strip() or None,
		mood=mood.strip() or None,
		parents=[],
		created_at=created_at,
	)

	return {
		"node_id": node_id,
		"blob_hash": blob_hash,
		"path": path,
		"size_bytes": len(wav_bytes),
		"content_type": "audio/wav",
	}
