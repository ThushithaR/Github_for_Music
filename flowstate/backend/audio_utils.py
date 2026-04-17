import subprocess
import librosa
import os

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
