import subprocess
import librosa
import os
import numpy as np
import wave


KEY_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

# Krumhansl-Schmuckler key profiles (major/minor), normalized at runtime.
MAJOR_PROFILE = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88], dtype=np.float32)
MINOR_PROFILE = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17], dtype=np.float32)


def _estimate_key(chroma):
    if chroma is None or chroma.size == 0:
        return "Unknown"

    pitch_energy = chroma.mean(axis=1).astype(np.float32)
    total_energy = float(pitch_energy.sum())
    if total_energy <= 1e-8:
        return "Unknown"

    # Normalize for scale-invariant correlation.
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


def _get_mood_from_logic(y, sr):
    spectral_centroid = np.mean(librosa.feature.spectral_centroid(y=y, sr=sr))
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


def _get_wav_duration(path):
    try:
        with wave.open(path, "rb") as wav_file:
            frame_count = wav_file.getnframes()
            frame_rate = wav_file.getframerate()
            if frame_rate <= 0:
                return 0.0
            return round(frame_count / float(frame_rate), 3)
    except Exception:
        return 0.0

def convert_to_wav(input_path, output_path):
    # Use ffmpeg from PATH
    import shutil
    ffmpeg_path = shutil.which("ffmpeg")
    if not ffmpeg_path:
        raise FileNotFoundError("FFmpeg not found in PATH. Please ensure it's installed.")
    
    subprocess.run([
        ffmpeg_path, "-y",
        "-i", input_path,
        "-ar", "44100",
        "-ac", "1",
        output_path
    ], check=True)

def extract_bpm(path):
    try:
        y, sr = librosa.load(path)
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        return float(tempo)
    except:
        return 0.0


def extract_audio_features(path):
    try:
        y, sr = librosa.load(path, mono=True)

        duration = _get_wav_duration(path)

        if y is None or len(y) == 0:
            return {
                "bpm": 0.0,
                "duration": duration,
                "musical_key": "Unknown",
                "mood": "neutral",
            }

        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)

        # Use CQT chroma for stabler tonal center estimation than raw STFT chroma.
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
        musical_key = _estimate_key(chroma)

        mood = _get_mood_from_logic(y, sr)

        return {
            "bpm": float(tempo),
            "duration": duration,
            "musical_key": musical_key,
            "mood": mood,
        }
    except Exception:
        return {
            "bpm": 0.0,
            "duration": _get_wav_duration(path),
            "musical_key": "Unknown",
            "mood": "neutral",
        }
