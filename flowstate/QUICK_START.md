# FlowState - Quick Start (5 minutes)

## ⚡ TL;DR Setup

### 1️⃣ Prerequisites (Install These First)
- **Python 3.8+** - https://python.org (check "Add to PATH" during install)
- **FFmpeg** - Windows: https://ffmpeg.org/download.html | Mac: `brew install ffmpeg` | Linux: `sudo apt install ffmpeg`
- **Git** - https://git-scm.com

### 2️⃣ Setup (from project folder)
```bash
# Create virtual environment
python -m venv venv
venv\Scripts\activate    # Windows
# OR: source venv/bin/activate    # Mac/Linux

# Install packages
cd backend
pip install -r requirements.txt
cd ..
```

### 3️⃣ Run (two terminal windows)

**Terminal 1 - Backend:**
```bash
cd backend
python main.py
# Should see: "Uvicorn running on http://127.0.0.1:8000"
```

**Terminal 2 - Frontend:**
```bash
cd frontend
python -m http.server 3000
# Open: http://localhost:3000
```

### 4️⃣ Test It
- Click "Start Recording" → Allow microphone → Record → Click "Capture Audio"
- Audio file should appear in `backend/audio/`

---

## 🆘 Common Issues

| Problem | Solution |
|---------|----------|
| `FFmpeg not found` | Install FFmpeg and restart terminal |
| `Port 8000 in use` | Run `uvicorn main:app --reload --port 8001` instead |
| `ModuleNotFoundError` | Check venv is activated, run `pip install -r requirements.txt` |
| `No microphone access` | Check browser permissions, refresh page |

---

**Still stuck?** See full [README.md](README.md) for detailed setup guide.
