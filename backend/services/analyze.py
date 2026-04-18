# backend/services/analyze.py

import librosa
import numpy as np
import subprocess
import tempfile
import os
import shutil
import json
import logging
import google.generativeai as genai

# ---------- CONFIGURE LOGGING ----------
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | [%(funcName)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# ---------- CONFIGURE GEMINI ----------
API_KEY = 'API KEY'
if API_KEY:
    genai.configure(api_key=API_KEY)
    logger.info("Gemini API configured successfully.")
else:
    logger.warning("GEMINI_API_KEY not found. Skipping AI semantics.")

# ---------- AUDIO NORMALIZATION ----------
def normalize_audio(input_path):
    logger.info(f"Normalizing audio: {input_path}")
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"File not found: {input_path}")

    output_path = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
    ffmpeg_bin = shutil.which("ffmpeg") or r"C:\ffmpeg\ffmpeg-8.1-full_build\bin\ffmpeg.exe"

    command = [
        ffmpeg_bin, "-y",
        "-fflags", "+genpts+discardcorrupt",
        "-analyzeduration", "10M", "-probesize", "10M",
        "-i", input_path,
        "-vn", "-ac", "1", "-ar", "22050", "-f", "wav",
        output_path
    ]

    try:
        subprocess.run(command, capture_output=True, text=True, check=True)
        return output_path
    except subprocess.CalledProcessError as e:
        logger.error(f"FFmpeg STDERR: {e.stderr[-500:]}")
        raise RuntimeError(f"FFmpeg conversion failed: {e.stderr[-300:]}")

# ---------- GEMINI SEMANTIC ANALYSIS ----------
def get_gemini_semantics(file_path):
    if not API_KEY:
        return None

    try:
        logger.info("Uploading file to Gemini...")
        audio_file = genai.upload_file(path=file_path)

        model = genai.GenerativeModel("models/gemini-2.5-flash")

        prompt = """
        Listen to this short audio fragment. 
        Analyze the music and return ONLY a valid JSON object.
        Do not include markdown like ```json.

        Required format:
        {
            "name": "2-4 word creative title",
            "mood": "one of [melancholic, dark, energetic, bright, chill, upbeat, tense]",
            "instrument": "primary instrument or vibe",
            "tags": ["tag1", "tag2", "tag3"]
        }
        """

        response = model.generate_content([prompt, audio_file])
        genai.delete_file(audio_file.name)

        result_text = response.text.strip()

        # --- Clean markdown wrappers ---
        if result_text.startswith("```json"):
            result_text = result_text[7:-3].strip()
        elif result_text.startswith("```"):
            result_text = result_text[3:-3].strip()

        # --- Safe JSON parsing ---
        try:
            return json.loads(result_text)
        except json.JSONDecodeError:
            logger.warning(f"Invalid JSON from Gemini:\n{result_text}")
            return None

    except Exception:
        logger.exception("Gemini API error:")
        return None

# ---------- LIBROSA ----------
def is_music(y, sr) -> bool:
    rms = float(np.mean(librosa.feature.rms(y=y)))
    flatness = float(np.mean(librosa.feature.spectral_flatness(y=y)))
    return not (rms < 0.01 or flatness > 0.5)

def get_bpm(y, sr):
    try:
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr, start_bpm=120)
        tempo = float(tempo[0]) if isinstance(tempo, np.ndarray) else float(tempo)
        return round(tempo, 1) if 40 <= tempo <= 240 else 120.0
    except Exception:
        return 120.0

def get_dominant_key(y, sr):
    try:
        chroma = librosa.feature.chroma_cens(y=y, sr=sr)
        chroma = librosa.decompose.nn_filter(chroma, aggregate=np.median)
        chroma_mean = np.mean(chroma, axis=1)

        major = np.array([6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88])
        minor = np.array([6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17])
        notes = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']

        best_score, best_key = -np.inf, "unknown"

        for i in range(12):
            maj = np.corrcoef(chroma_mean, np.roll(major, i))[0, 1]
            minr = np.corrcoef(chroma_mean, np.roll(minor, i))[0, 1]

            if maj > best_score:
                best_score, best_key = maj, f"{notes[i]} maj"
            if minr > best_score:
                best_score, best_key = minr, f"{notes[i]} min"

        return best_key if best_score > 0.1 else "C maj"

    except Exception:
        return "unknown"

# ---------- MAIN ----------
def analyze(wav_path: str) -> dict:
    logger.info(f"--- Starting analysis for {wav_path} ---")
    clean_path = None

    try:
        clean_path = normalize_audio(wav_path)
        y, sr = librosa.load(clean_path, sr=None)
        duration = len(y) / sr

        if duration < 1.0 or not is_music(y, sr):
            return {
                "bpm": 0.0, "key": "None", "mood": "chill",
                "instrument": "unknown", "name": "Quick Fragment",
                "tags": [], "duration": round(duration, 1),
                "is_music": False
            }

        bpm = get_bpm(y, sr)
        key = get_dominant_key(y, sr)
        gemini_data = get_gemini_semantics(clean_path)

        if gemini_data:
            mood = gemini_data.get("mood", "chill")
            instrument = gemini_data.get("instrument", "synth")
            name = gemini_data.get("name", "New Idea")
            tags = gemini_data.get("tags", [])
        else:
            mood, instrument, name, tags = "chill", "synth", "Fragment", []

        return {
            "bpm": bpm,
            "key": key,
            "mood": mood,
            "instrument": instrument,
            "name": name,
            "tags": tags,
            "duration": round(duration, 2),
            "is_music": True,
        }

    except Exception:
        logger.exception("CRITICAL ERROR:")
        return {
            "bpm": 120.0, "key": "C maj", "mood": "chill",
            "instrument": "synth", "name": "Error Fragment",
            "tags": [], "duration": 0.0, "is_music": False
        }

    finally:
        if clean_path and os.path.exists(clean_path):
            try:
                os.remove(clean_path)
            except Exception:
                pass

# ---------- TEST ----------
if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        result = analyze(sys.argv[1])
        print(json.dumps(result, indent=4))
    else:
        print("Usage: python analyze.py <audio_file>")