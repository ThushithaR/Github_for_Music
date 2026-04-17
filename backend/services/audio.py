import hashlib
import os
import tempfile
import subprocess
from pathlib import Path

# backend/services/audio.py -> backend/assets/blobs
BLOB_DIR = Path(__file__).resolve().parent.parent / "assets" / "blobs"
BLOB_DIR.mkdir(parents=True, exist_ok=True)


def _run_ffmpeg(cmd: list):
    """
    Run ffmpeg/ffprobe command, raise if it fails.
    """
    subprocess.run(
        cmd,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=True,
    )


def convert_to_wav(webm_bytes: bytes) -> bytes:
    """
    Convert WebM/Opus bytes to WAV (mono, 22050 Hz).
    """
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as in_f:
        in_f.write(webm_bytes)
        in_path = in_f.name

    out_path = in_path.replace(".webm", ".wav")

    try:
        _run_ffmpeg([
            "ffmpeg",
            "-y",
            "-i", in_path,
            "-ac", "1",        # mono
            "-ar", "22050",    # sample rate for librosa
            out_path,
        ])

        with open(out_path, "rb") as f:
            return f.read()

    finally:
        for p in (in_path, out_path):
            if os.path.exists(p):
                os.remove(p)


def hash_audio(wav_bytes: bytes) -> str:
    return hashlib.sha256(wav_bytes).hexdigest()


def save_blob(blob_hash: str, wav_bytes: bytes) -> str:
    path = BLOB_DIR / f"{blob_hash}.wav"
    if not path.exists():
        with open(path, "wb") as f:
            f.write(wav_bytes)
    return str(path)


def load_blob(blob_hash: str) -> bytes:
    path = BLOB_DIR / f"{blob_hash}.wav"
    if not path.exists():
        raise FileNotFoundError(blob_hash)
    with open(path, "rb") as f:
        return f.read()


def merge_audio(hash_a: str, hash_b: str) -> bytes:
    """
    Merge two WAV blobs using ffmpeg amix + normalization.
    Returns WAV bytes.
    """
    path_a = BLOB_DIR / f"{hash_a}.wav"
    path_b = BLOB_DIR / f"{hash_b}.wav"

    if not path_a.exists() or not path_b.exists():
        raise FileNotFoundError("Missing input blobs")

    out_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as out_f:
            out_path = out_f.name

        # amix overlays; duration=longest keeps full length
        # loudnorm prevents clipping / evens levels
        _run_ffmpeg([
            "ffmpeg",
            "-y",
            "-i", str(path_a),
            "-i", str(path_b),
            "-filter_complex",
            "amix=inputs=2:duration=longest:dropout_transition=0,"
            "loudnorm=I=-16:TP=-1.5:LRA=11",
            "-ac", "1",
            "-ar", "22050",
            out_path,
        ])

        with open(out_path, "rb") as f:
            return f.read()

    finally:
        if out_path and os.path.exists(out_path):
            os.remove(out_path)