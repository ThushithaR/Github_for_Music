# FlowState MVP - Audio Idea Capture System

A voice-based idea capture system that records audio, extracts tempo (BPM), and organizes ideas in a branching tree structure.

---

## 🚀 Setup Guide for New Users

### Prerequisites

Before you start, make sure you have:

1. **Python 3.8+** - [Download here](https://www.python.org/downloads/)
   - During installation, **check "Add Python to PATH"**
   
2. **FFmpeg** - Required for audio conversion
   - **Windows:** [Download from FFmpeg website](https://ffmpeg.org/download.html) or use `choco install ffmpeg` (if using Chocolatey)
   - **Mac:** `brew install ffmpeg`
   - **Linux:** `sudo apt-get install ffmpeg`
   - **Verify:** Open terminal/cmd and run `ffmpeg -version`

3. **Git** - [Download here](https://git-scm.com/downloads)

---

## 📦 Installation Steps

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd flowstate
```

### 2. Create a Virtual Environment

**Windows (Command Prompt):**
```bash
python -m venv venv
venv\Scripts\activate
```

**Windows (PowerShell):**
```bash
python -m venv venv
.\venv\Scripts\Activate.ps1
```

**Mac/Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Python Dependencies

The `requirements.txt` file should already exist in the `backend/` folder. Install it with:
```bash
cd backend
pip install -r requirements.txt
cd ..
```

If `requirements.txt` doesn't exist, create it with:
```
fastapi==0.104.1
uvicorn==0.24.0
librosa==0.10.0
numpy==1.24.3
soundfile==0.12.1
scipy==1.11.4
python-multipart==0.0.6
```

---

## ▶️ Running the Application

### Step 1: Start the Backend Server

**Windows (Command Prompt):**
```bash
cd backend
python main.py
```

Or if that doesn't work, try uvicorn directly:
```bash
cd backend
uvicorn main:app --reload --port 8000
```

**Mac/Linux:**
```bash
cd backend
python3 main.py
```

✅ You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
```

### Step 2: Open the Frontend (in a new terminal)

Keep the backend running and open the frontend:

**Option A - Local Server (Recommended):**
```bash
# In the frontend folder
cd frontend
python -m http.server 3000
```
Then open your browser to: **`http://localhost:3000`**

**Option B - File Path:**
Open this file directly in your browser (replace with your actual path):
```
file:///C:/Users/YourName/Desktop/rvu%20hackathon/Github_for_Music/flowstate/frontend/index.html
```

---

## ✅ Verification Checklist

Before considering setup complete, verify:

- [ ] Python virtual environment activated
- [ ] All packages installed (`pip list` shows fastapi, librosa, etc.)
- [ ] FFmpeg working (`ffmpeg -version` in terminal)
- [ ] Backend running on `http://localhost:8000`
- [ ] Frontend opens in browser
- [ ] "Start Recording" button is visible
- [ ] Browser asks for microphone permission when you click "Start Recording"
- [ ] Can record audio and click "Capture Audio"
- [ ] Audio files appear in `backend/audio/` folder

---

## 🎯 How to Use

1. **Start Recording**
   - Click the "Start Recording" button
   - Allow browser microphone access when prompted
   - Recording will start with a 3-second rolling buffer

2. **Capture Audio**
   - Click "Capture Audio" to save the current buffer
   - Backend will:
     - Convert WebM audio → WAV format
     - Extract BPM (tempo/beats per minute)
     - Store metadata in SQLite database
   - Your audio file saves to: `backend/audio/`

3. **View Captured Ideas**
   - All captured ideas appear with their BPM
   - Click play to listen back
   - Click "Branch this idea" to create child nodes

---

## 📁 Project Structure

```
flowstate/
├── README.md                  (This file)
├── requirements.txt           (Python dependencies)
├── backend/
│   ├── main.py                (FastAPI server)
│   ├── db.py                  (SQLite database setup)
│   ├── audio_utils.py         (FFmpeg & BPM extraction)
│   ├── database.db            (Created on first run)
│   └── audio/                 (Captured audio files)
└── frontend/
    ├── index.html             (Web interface)
    └── app.js                 (Frontend JavaScript)
```

---

## 🔧 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/capture` | Upload audio → Extract BPM → Store |
| `GET` | `/nodes` | Get all idea nodes |
| `POST` | `/branch/{parent_id}` | Create child node |

---

## 🆘 Troubleshooting

### ❌ FFmpeg not found
```
Error: FFmpeg not found in PATH
```
**Solution:** 
- **Windows:** Download from [ffmpeg.org](https://ffmpeg.org/download.html), extract, and add to PATH
  - Or: `choco install ffmpeg` (if using Chocolatey)
- **Mac:** `brew install ffmpeg`
- **Linux:** `sudo apt-get install ffmpeg`
- **Verify:** Run `ffmpeg -version` in terminal

---

### ❌ Port 8000 already in use
```
OSError: [Errno 48] Address already in use
```
**Solution:** Use a different port:
```bash
uvicorn main:app --reload --port 8001
```
Then update the frontend API URL from `http://localhost:8000` to `http://localhost:8001`

---

### ❌ Module not found errors
```
ModuleNotFoundError: No module named 'fastapi'
```
**Solution:** Make sure your virtual environment is activated and requirements installed:
```bash
# Activate venv first
python -m pip install -r backend/requirements.txt
```

---

### ❌ Database errors
```
sqlite3.OperationalError: table nodes already exists
```
**Solution:** Delete the old database and restart:
```bash
# In the backend folder
del database.db
python main.py
```

---

### ❌ No microphone access in browser
**Solution:**
- Check browser permissions (look for microphone icon in address bar)
- Try a different browser
- Refresh the page

---

### ❌ Backend running but frontend can't connect
**Solution:** Check that both are running:
- Backend: Open `http://localhost:8000` in browser (should show FastAPI docs)
- Check browser console for errors (F12 → Console tab)
- Make sure frontend is on `http://localhost:3000` (or correct file path)

---

## 💾 Database Schema

```sql
CREATE TABLE nodes (
    id TEXT PRIMARY KEY,           -- UUID for each idea
    file TEXT,                     -- Path to audio file
    bpm REAL,                      -- Beats per minute (extracted from audio)
    parents TEXT                   -- JSON array of parent IDs (for branching)
);
```

---

## ✅ What's Working (MVP Features)

✅ Continuous mic recording with rolling buffer  
✅ Capture audio chunks as "ideas"  
✅ Backend processing (WebM → WAV conversion)  
✅ BPM extraction from audio  
✅ SQLite metadata storage  
✅ Idea node creation & branching  
✅ Audio playback in browser  

---

## 🚧 Future Features

❌ Graph visualization (show idea branches)  
❌ Semantic search across ideas  
❌ Mood/instrument tagging  
❌ Audio merging/combining  
❌ Cloud storage integration  

---

## 📞 Support

If you run into issues:

1. Check the terminal output for error messages
2. Verify all prerequisites are installed (`python --version`, `ffmpeg -version`)
3. Make sure virtual environment is activated
4. Check that both backend and frontend are running
5. Clear browser cache if frontend won't load

---

Made with ❤️ for the RVU Hackathon
