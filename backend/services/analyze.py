# backend/services/analyze.py

import librosa
import numpy as np


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

        if len(y_chunk) < sr * 2:  # skip very short chunks
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
    try:
        y, sr = librosa.load(wav_path, sr=None)

        if len(y) < sr * 1:
            return {
                "bpm": 0.0,
                "key": "unknown",
                "mood": "chill",
                "key_timeline": []
            }

        return {
            "bpm": get_bpm(y, sr),
            "key": get_dominant_key(y, sr),
            "mood": get_mood(y, sr),
            "key_timeline": get_key_timeline(y, sr)
        }

    except Exception as e:
        print(f"[analyze error] {e}")
        return {
            "bpm": 0.0,
            "key": "unknown",
            "mood": "chill",
            "key_timeline": []
        }


# ---------- TEST ----------
if __name__ == "__main__":
    import sys

    path = sys.argv[1] if len(sys.argv) > 1 else "test.wav"
    result = analyze(path)
    print(result)