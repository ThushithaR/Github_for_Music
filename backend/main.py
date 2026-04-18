print("THIS IS THE CORRECT MAIN.PY")
import os
import shutil
import uuid
from fastapi import FastAPI, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware

# Import the logic from your services folder
from services.analyze import analyze

app = FastAPI(title="GOODWINSUN Analysis API")

# 1. THE SECURITY GATE: This MUST be defined before any routes
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows your React app at localhost:3000 to connect
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TEMP_DIR = "temp_audio"
os.makedirs(TEMP_DIR, exist_ok=True)

def cleanup_file(filepath: str):
    """Deletes the temporary file after the response is sent."""
    try:
        if os.path.exists(filepath):
            os.remove(filepath)
    except Exception as e:
        print(f"Cleanup error: {e}")

# --- ROUTES ---

@app.get("/")
def read_root():
    print('accessed')
    return {"status": "Backend is running!"}

@app.post("/api/analyze")
async def analyze_audio(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    # Safely handle the filename for Windows compatibility
    safe_filename = file.filename if file.filename else f"capture_{uuid.uuid4().hex[:4]}.webm"
    file_path = os.path.join(TEMP_DIR, safe_filename)
    
    # Save the incoming file from the browser
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    try:
        # Run your Librosa + Gemini logic from analyze.py
        analysis_result = analyze(file_path)
        
        # Add a unique ID for the frontend to track
        analysis_result["id"] = uuid.uuid4().hex[:8]
        
        return analysis_result
        
    except Exception as e:
        # Fallback in case of a crash during analysis
        return {"error": str(e), "is_music": False}
        
    finally:
        # Schedule cleanup so we don't fill your hard drive with temp files
        background_tasks.add_task(cleanup_file, file_path)

if __name__ == "__main__":
    import uvicorn
    # Listen on 127.0.0.1 to match your frontend fetch call
    uvicorn.run(app, host="127.0.0.1", port=8000)
