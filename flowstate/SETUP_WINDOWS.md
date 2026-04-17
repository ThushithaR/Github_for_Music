# FlowState Setup Guide - Windows

Complete step-by-step guide for Windows users.

---

## Step 1: Install Prerequisites

### Install Python 3.8+

1. Go to https://www.python.org/downloads/
2. Download the latest Python installer (3.11 or higher recommended)
3. **IMPORTANT:** During installation:
   - ✅ Check the box: **"Add Python to PATH"**
   - ✅ Check: **"Install pip"**
4. Click "Install Now"
5. Wait for installation to complete
6. Restart your computer (optional but recommended)

**Verify Python installed:**
```cmd
python --version
```
Should show version 3.x.x

---

### Install FFmpeg

FFmpeg is required to convert audio files.

#### Option A: Download Manually (Easiest)
1. Go to https://ffmpeg.org/download.html
2. Download the Windows Build (usually a .zip file)
3. Extract the folder anywhere (e.g., `C:\ffmpeg\`)
4. Copy the path to the `bin` folder inside
5. Add FFmpeg to Windows PATH:
   - Right-click "This PC" or "My Computer" → Properties
   - Click "Advanced system settings"
   - Click "Environment Variables"
   - Under "System variables", click "New"
   - Variable name: `FFMPEG_PATH`
   - Variable value: `C:\ffmpeg\bin` (or your actual path)
   - Click OK → OK → OK
6. Restart Command Prompt / PowerShell
7. Verify: 
   ```cmd
   ffmpeg -version
   ```

#### Option B: Using Chocolatey (If you have it)
```cmd
choco install ffmpeg
```

---

### Install Git

1. Go to https://git-scm.com/download/win
2. Download and run the installer
3. Accept all default options
4. Click "Install"

---

## Step 2: Clone the Repository

Open Command Prompt and navigate to where you want the project:

```cmd
cd Desktop
git clone <your-github-repo-url>
cd flowstate
```

(Replace `<your-github-repo-url>` with your actual GitHub URL)

---

## Step 3: Create Python Virtual Environment

This keeps project dependencies isolated.

**In Command Prompt, in the flowstate folder:**

```cmd
python -m venv venv
```

Wait for this to complete (creates a `venv` folder)

---

## Step 4: Activate Virtual Environment

**IMPORTANT: Do this every time before working on the project**

```cmd
venv\Scripts\activate
```

You should see `(venv)` at the beginning of your command prompt line.

---

## Step 5: Install Python Dependencies

```cmd
cd backend
pip install -r requirements.txt
cd ..
```

This installs:
- FastAPI (web server)
- Uvicorn (server runner)
- Librosa (BPM extraction)
- And dependencies

---

## Step 6: Run the Backend

**Keep venv activated, in Command Prompt:**

```cmd
cd backend
python main.py
```

You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
```

✅ Backend is running! Keep this window open.

---

## Step 7: Run the Frontend

**In a NEW Command Prompt window:**

```cmd
cd flowstate\frontend
python -m http.server 3000
```

You should see:
```
Serving HTTP on 0.0.0.0 port 3000 (http://0.0.0.0:3000/)
```

---

## Step 8: Open in Browser

1. Open your web browser (Chrome, Edge, Firefox, etc.)
2. Go to: **`http://localhost:3000`**
3. You should see the FlowState app!
4. Click "Start Recording" and allow microphone access

---

## Step 9: Test Recording

1. Click "Start Recording"
2. Speak some words (3+ seconds)
3. Click "Capture Audio"
4. Check `backend/audio/` folder - should have a new file

✅ **Setup complete!**

---

## Troubleshooting

### FFmpeg command not found
**Solution:**
- Make sure you added FFmpeg to PATH correctly
- Restart Command Prompt completely (close and reopen)
- Verify: `ffmpeg -version`

### "Python is not recognized"
**Solution:**
- Reinstall Python and **check "Add Python to PATH"** during installation
- Restart computer
- Verify: `python --version`

### "No module named 'fastapi'"
**Solution:**
- Make sure `(venv)` is showing in your command prompt
- Run: `pip install -r backend/requirements.txt` again

### Port 8000 is already in use
**Solution:**
- Find what's using port 8000: `netstat -ano | findstr :8000`
- Or just use a different port:
  ```cmd
  cd backend
  uvicorn main:app --reload --port 8001
  ```
- Update frontend to use `http://localhost:8001`

### Browser asks for microphone but nothing happens
**Solution:**
- Check browser permissions (look for microphone icon in address bar)
- Try a different browser
- Refresh page with F5

### "ModuleNotFoundError" when running server
**Solution:**
```cmd
# Make sure venv is activated (you see (venv) in prompt)
pip install -r backend/requirements.txt
python main.py
```

### Files in backend/audio/ folder are empty
**Solution:**
- Check that FFmpeg is working: `ffmpeg -version`
- Check backend terminal for error messages
- Might be a permission issue - try running as Administrator

---

## Next Steps

- See [README.md](README.md) for full feature documentation
- Check [QUICK_START.md](QUICK_START.md) for quick reference

---

## Still Need Help?

1. Check the terminal output for error messages (copy the full error)
2. Verify prerequisites are installed:
   ```cmd
   python --version
   ffmpeg -version
   git --version
   ```
3. Make sure virtual environment is activated (`(venv)` visible in prompt)
4. Try a fresh venv:
   ```cmd
   rmdir venv /s
   python -m venv venv
   venv\Scripts\activate
   pip install -r backend/requirements.txt
   ```

Good luck! 🚀
