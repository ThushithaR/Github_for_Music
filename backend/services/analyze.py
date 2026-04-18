# backend/services/analyze.py

import librosa
import numpy as np
import subprocess
import tempfile
import os
import shutil
import traceback


def _resolve_ffmpeg_executable() -> str:
    env_path = os.environ.get("GOODWINSUN_FFMPEG")
    if env_path:
        return env_path

    for candidate in ("ffmpeg", "ffmpeg.exe"):
        resolved = shutil.which(candidate)
        if resolved:
            return resolved

    bundled = r"C:\ffmpeg\ffmpeg-8.1-full_build\bin\ffmpeg.exe"
    if os.path.exists(bundled):
        return bundled

    raise FileNotFoundError(
        "FFmpeg executable not found. Set GOODWINSUN_FFMPEG or add ffmpeg to PATH."
    )


# ---------- AUDIO NORMALIZATION (FFmpeg) ----------
def normalize_audio(input_path):
    output_path = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
    ffmpeg_executable = _resolve_ffmpeg_executable()

    print("\n===== DEBUG =====")
    print("Input path:", input_path)
    print("Exists:", os.path.exists(input_path))
    print("FFmpeg:", ffmpeg_executable)

    if os.path.exists(input_path):
        print("Size:", os.path.getsize(input_path))

    command = [
    ffmpeg_executable,
    "-y",
    "-i", input_path,
    "-vn",              # ignore video streams
    "-ac", "1",
    "-ar", "22050",
    "-f", "wav",
    output_path
]

    result = subprocess.run(command, capture_output=True, text=True)

    print("\n===== FFMPEG STDERR =====")
    print(result.stderr)

    if result.returncode != 0:
        raise RuntimeError("FFmpeg conversion failed")

    return output_path


# ---------- BPM ----------
def get_bpm(y, sr):
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)

    if isinstance(tempo, np.ndarray):
        tempo = float(tempo[0])

    return round(float(tempo), 1)


# ---------- KEY CORE ----------
def detect_key_from_chroma(chroma_mean):
    major_profile = np.array([
        6.35,2.23,3.48,2.33,4.38,4.09,
        2.52,5.19,2.39,3.66,2.29,2.88
    ])

    minor_profile = np.array([
        6.33,2.68,3.52,5.38,2.60,3.53,
        2.54,4.75,3.98,2.69,3.34,3.17
    ])

    note_names = ['C','C#','D','D#','E','F',
                  'F#','G','G#','A','A#','B']

    best_score = -np.inf
    best_key = "unknown"

    for i in range(12):
        rotated_major = np.roll(major_profile, i)
        rotated_minor = np.roll(minor_profile, i)

        score_major = np.corrcoef(chroma_mean, rotated_major)[0, 1]
        score_minor = np.corrcoef(chroma_mean, rotated_minor)[0, 1]

        if score_major > best_score + 0.02:
            best_score = score_major
            best_key = f"{note_names[i]} major"

        if score_minor > best_score + 0.02:
            best_score = score_minor
            best_key = f"{note_names[i]} minor"

    if best_score < 0.1:
        return "unknown"

    return best_key


# ---------- DOMINANT KEY ----------
def get_dominant_key(y, sr):
    chroma = librosa.feature.chroma_cens(y=y, sr=sr)

    chroma_smooth = librosa.decompose.nn_filter(
        chroma,
        aggregate=np.median,
        metric='cosine'
    )

    chroma_mean = np.mean(chroma_smooth, axis=1)

    return detect_key_from_chroma(chroma_mean)


# ---------- KEY TIMELINE ----------
def get_key_timeline(y, sr, chunk_duration=10):
    total_duration = len(y) / sr
    chunk_samples = int(sr * chunk_duration)

    timeline = []

    for start in range(0, len(y), chunk_samples):
        end = start + chunk_samples
        y_chunk = y[start:end]

        if len(y_chunk) < sr * 2:
            continue

        chroma = librosa.feature.chroma_cens(y=y_chunk, sr=sr)
        chroma_mean = np.mean(chroma, axis=1)

        key = detect_key_from_chroma(chroma_mean)

        timeline.append({
            "start": round(start / sr, 1),
            "end": round(min(end / sr, total_duration), 1),
            "key": key
        })

    return timeline


# ---------- MOOD ----------
def get_mood(y, sr):
    spectral_centroid = np.mean(
        librosa.feature.spectral_centroid(y=y, sr=sr)
    )

    rms = np.mean(librosa.feature.rms(y=y))

    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    if isinstance(tempo, np.ndarray):
        tempo = float(tempo[0])

    centroid_norm = spectral_centroid / (sr / 2)

    if tempo > 110 and rms > 0.05:
        return "energetic"

    if tempo < 80 and rms < 0.04:
        return "sad"

    if centroid_norm > 0.25:
        return "happy"

    if tempo < 95:
        return "chill"

    return "dark"


# ---------- MAIN ----------
def analyze(wav_path: str) -> dict:
    clean_path = None

    try:
        # Step 1: Normalize audio via FFmpeg
        clean_path = normalize_audio(wav_path)

        # Step 2: Load safely
        y, sr = librosa.load(clean_path, sr=None)

        if len(y) < sr * 1:
            return {
                "bpm": 0.0,
                "key": "unknown",
                "mood": "chill",
                "key_timeline": []
            }

        # Step 3: Compute features
        return {
            "bpm": get_bpm(y, sr),
            "key": get_dominant_key(y, sr),
            "mood": get_mood(y, sr),
            "key_timeline": get_key_timeline(y, sr)
        }

    except Exception:
        print("\n[ANALYZE ERROR - FULL TRACE]")
        traceback.print_exc()

        return {
            "bpm": 0.0,
            "key": "unknown",
            "mood": "chill",
            "key_timeline": []
        }

    finally:
        # Step 4: Always clean temp file
        if clean_path and os.path.exists(clean_path):
            try:
                os.remove(clean_path)
            except Exception as cleanup_error:
                print(f"Cleanup failed: {cleanup_error}")


# ---------- TEST ----------
if __name__ == "__main__":
    import sys

    path = sys.argv[1] if len(sys.argv) > 1 else "test.wav"
    result = analyze(path)
    print(result)