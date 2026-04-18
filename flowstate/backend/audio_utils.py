import shutil
import subprocess
import wave

import librosa
import numpy as np


KEY_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
MAJOR_PROFILE = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88], dtype=np.float32)
MINOR_PROFILE = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17], dtype=np.float32)


def _to_float_tempo(value: object, default: float = 0.0) -> float:
    if isinstance(value, np.ndarray):
        if value.size == 0:
            return default
        return float(value.reshape(-1)[0])
    try:
        return float(value)
    except Exception:
        return default


def _estimate_key(chroma: np.ndarray) -> str:
    if chroma is None or chroma.size == 0:
        return "Unknown"

    pitch_energy = chroma.mean(axis=1).astype(np.float32)
    total_energy = float(pitch_energy.sum())
    if total_energy <= 1e-8:
        return "Unknown"

    pitch_energy /= total_energy

    major_profile = MAJOR_PROFILE / MAJOR_PROFILE.sum()
    minor_profile = MINOR_PROFILE / MINOR_PROFILE.sum()

    best_score = -1.0
    best_idx = 0
    best_mode = "major"

    for shift in range(12):
        major_score = float(np.dot(pitch_energy, np.roll(major_profile, shift)))
        if major_score > best_score:
            best_score = major_score
            best_idx = shift
            best_mode = "major"

        minor_score = float(np.dot(pitch_energy, np.roll(minor_profile, shift)))
        if minor_score > best_score:
            best_score = minor_score
            best_idx = shift
            best_mode = "minor"

    return f"{KEY_NAMES[best_idx]} {best_mode}"


def _get_mood_from_logic(y: np.ndarray, sr: int) -> str:
    spectral_centroid = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))
    rms = float(np.mean(librosa.feature.rms(y=y)))

    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    tempo_value = _to_float_tempo(tempo, default=95.0)

    centroid_norm = spectral_centroid / (sr / 2.0)

    if tempo_value > 110 and rms > 0.05:
        return "energetic"
    if tempo_value < 80 and rms < 0.04:
        return "sad"
    if centroid_norm > 0.25:
        return "happy"
    if tempo_value < 95:
        return "chill"
    return "dark"


def _get_wav_duration(path: str) -> float:
    try:
        with wave.open(path, "rb") as wav_file:
            frame_count = wav_file.getnframes()
            frame_rate = wav_file.getframerate()
            if frame_rate <= 0:
                return 0.0
            return round(frame_count / float(frame_rate), 3)
    except Exception:
        return 0.0


def convert_to_wav(input_path: str, output_path: str) -> None:
    ffmpeg_path = shutil.which("ffmpeg")
    if not ffmpeg_path:
        raise FileNotFoundError("FFmpeg not found in PATH. Please ensure it is installed.")

    cmd = [
        ffmpeg_path,
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-fflags",
        "+discardcorrupt",
        "-err_detect",
        "ignore_err",
        "-i",
        input_path,
        "-vn",
        "-acodec",
        "pcm_s16le",
        "-ar",
        "48000",
        "-ac",
        "2",
        output_path,
    ]

    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True, timeout=45)
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError("FFmpeg conversion timed out") from exc
    except subprocess.CalledProcessError as exc:
        stderr = (exc.stderr or "").strip()
        detail = stderr if stderr else "Unknown ffmpeg error"
        raise RuntimeError(f"FFmpeg conversion failed: {detail}") from exc


def extract_audio_features(path: str) -> dict:
    duration = _get_wav_duration(path)

    try:
        y, sr = librosa.load(path, sr=None, mono=True)

        if y is None or len(y) == 0:
            return {
                "bpm": 0.0,
                "duration": duration,
                "musical_key": "Unknown",
                "mood": "neutral",
            }

        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        bpm = _to_float_tempo(tempo, default=0.0)

        try:
            chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
            musical_key = _estimate_key(chroma)
        except Exception:
            musical_key = "Unknown"

        try:
            mood = _get_mood_from_logic(y, sr)
        except Exception:
            mood = "neutral"

        return {
            "bpm": round(bpm, 2),
            "duration": duration,
            "musical_key": musical_key,
            "mood": mood,
        }
    except Exception:
        return {
            "bpm": 0.0,
            "duration": duration,
            "musical_key": "Unknown",
            "mood": "neutral",
        }
