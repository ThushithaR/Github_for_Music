import os
import shutil
from fastapi import FastAPI, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from services.analyze import analyze

app = FastAPI(title="GOODWINSUN Analysis API")

# Allow requests from the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TEMP_DIR = "temp_audio"
os.makedirs(TEMP_DIR, exist_ok=True)

def cleanup_file(filepath: str):
    try:
        if os.path.exists(filepath):
            os.remove(filepath)
    except Exception as e:
        print(f"Error cleaning up file {filepath}: {e}")

import subprocess

def convert_to_wav(input_path: str) -> str:
    """Converts input audio file to WAV using ffmpeg."""
    output_path = input_path.rsplit('.', 1)[0] + "_converted.wav"
    try:
        # -y to overwrite if exists
        subprocess.run(['ffmpeg', '-y', '-i', input_path, output_path], 
                       check=True, capture_output=True, text=True)
        return output_path
    except subprocess.CalledProcessError as e:
        print(f"FFmpeg conversion failed: {e.stderr}")
        return input_path
    except FileNotFoundError:
        print("FFmpeg not found in PATH. Skipping conversion.")
        return input_path

@app.post("/api/analyze")
async def analyze_audio(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    # Save the uploaded file temporarily
    file_path = os.path.join(TEMP_DIR, file.filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    final_wav_path = file_path
    
    # Check if conversion is needed (simple extension check)
    if not file.filename.lower().endswith('.wav'):
        final_wav_path = convert_to_wav(file_path)
        # Schedule the original file for deletion early if it was converted
        if final_wav_path != file_path:
            background_tasks.add_task(cleanup_file, file_path)
            
    try:
        # Run the analysis
        analysis_result = analyze(final_wav_path)
    finally:
        # Schedule the final file for deletion after the response is sent
        background_tasks.add_task(cleanup_file, final_wav_path)
        
    return analysis_result

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
