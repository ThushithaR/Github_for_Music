# Troubleshooting Guide

Common issues and solutions when running FlowState.

---

## Installation Issues

### "Python is not recognized as an internal or external command"

**Cause:** Python not in PATH

**Solutions:**
- **Windows:** Reinstall Python and check "Add Python to PATH" during installation
- **Mac/Linux:** Verify installation: `which python3`
- Restart terminal/command prompt after reinstalling

---

### "FFmpeg not found in PATH"

**Cause:** FFmpeg not installed or not in system PATH

**Solutions:**

**Windows:**
1. Download FFmpeg: https://ffmpeg.org/download.html
2. Extract to a folder (e.g., `C:\ffmpeg`)
3. Add to PATH:
   - Settings → System → About → Advanced system settings
   - Environment Variables → New System Variable
   - Name: `PATH` (or edit existing)
   - Add: `C:\ffmpeg\bin`
4. Restart terminal
5. Verify: `ffmpeg -version`

**Mac:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt-get install ffmpeg
```

---

### "No module named 'fastapi'" or other ModuleNotFoundError

**Cause:** Dependencies not installed or wrong virtual environment

**Solutions:**
```bash
# 1. Check virtual environment is activated (should see (venv) in prompt)
python -m venv venv
source venv/bin/activate          # Mac/Linux
# OR: venv\Scripts\activate       # Windows

# 2. Reinstall dependencies
pip install -r backend/requirements.txt

# 3. Try upgrading pip
python -m pip install --upgrade pip

# 4. If still failing, try installing manually:
pip install fastapi uvicorn librosa numpy soundfile scipy python-multipart
```

---

## Runtime Issues

### Port 8000 already in use

**Error:**
```
OSError: [Errno 48] Address already in use
```

**Solutions:**

Option 1 - Use a different port:
```bash
cd backend
uvicorn main:app --reload --port 8001
```
Then update frontend to use `http://localhost:8001`

Option 2 - Find and kill process using port 8000:

**Windows:**
```cmd
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

**Mac/Linux:**
```bash
lsof -i :8000
kill -9 <PID>
```

---

### Database errors: "table nodes already exists"

**Cause:** Corrupted or old database file

**Solution:**
```bash
# Navigate to backend folder
cd backend

# Delete the database
rm database.db          # Mac/Linux
# OR: del database.db  # Windows

# Restart the server
python main.py
```

---

### Frontend can't connect to backend

**Symptoms:**
- Frontend loads but ideas won't save
- Error in browser console about network failure

**Solutions:**

1. **Check both are running:**
   - Backend: Open `http://localhost:8000` in browser
   - Should show FastAPI swagger docs
   - If not, restart backend

2. **Check CORS is enabled:**
   - Backend `main.py` should have CORS middleware
   - Should allow all origins for development

3. **Check correct port:**
   - Backend running on 8000?
   - Frontend API calls using `http://localhost:8000`?
   - If changed port, update both

4. **Browser console errors:**
   - Press F12 in browser
   - Check Console tab for error messages
   - Check Network tab to see failed requests

---

## Audio Issues

### "No microphone access" or "Permission denied"

**Cause:** Browser microphone permissions

**Solutions:**
- Look for microphone icon in address bar, click allow
- Try different browser
- Refresh page (F5)
- Check OS microphone settings
- Try in private/incognito window

---

### Audio files not appearing in backend/audio/

**Cause:** Several possibilities

**Debug steps:**
1. Check `backend/audio/` folder exists
2. Verify FFmpeg working: `ffmpeg -version`
3. Check backend terminal for error messages
4. Try manual FFmpeg conversion:
   ```bash
   ffmpeg -i test.webm -ar 44100 -ac 1 test.wav
   ```
5. Check file permissions on audio folder
6. Try running as Administrator (Windows)

---

### BPM showing as 0.0

**Cause:** Librosa couldn't extract tempo

**Solutions:**
- Audio might be too short (try longer recording)
- Audio quality issue - try clearer sound
- Librosa sometimes fails on very quiet audio
- Check audio file exists: `backend/audio/[id].wav`

---

## Mac/Linux Specific

### "Permission denied" when running scripts

**Solution:**
```bash
chmod +x backend/main.py
python backend/main.py
```

---

### "ModuleNotFoundError: No module named 'X'"

**Solution:**
```bash
# Make sure you're using Python 3
python3 -m venv venv
source venv/bin/activate
python -m pip install --upgrade pip
pip install -r backend/requirements.txt
```

---

## Development/Testing

### Clearing all data to start fresh

```bash
# Delete database
rm backend/database.db

# Clear audio files (optional)
rm -rf backend/audio/*

# Restart backend
python main.py
```

---

### Running in development vs. production

**Development (with auto-reload):**
```bash
cd backend
uvicorn main:app --reload --port 8000
```

**Production:**
```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000
```

---

## Still Stuck?

**Collecting debugging info:**

When asking for help, provide:
1. **Your OS:** Windows/Mac/Linux and version
2. **Python version:** `python --version`
3. **Full error message:** (screenshot or copy-paste)
4. **Steps you took:** What did you do when error occurred?
5. **Terminal output:** Any messages before the error?

This info helps diagnose issues quickly!

---

## Quick Checklist

Before reporting an issue, verify:

- [ ] Python 3.8+ installed: `python --version`
- [ ] FFmpeg installed: `ffmpeg -version`
- [ ] Virtual environment activated: `(venv)` visible in prompt
- [ ] Dependencies installed: `pip list | grep fastapi`
- [ ] Backend running: Check `http://localhost:8000` in browser
- [ ] Frontend running: Check `http://localhost:3000` in browser
- [ ] No errors in terminal windows
- [ ] Browser console clear (F12 → Console tab)
- [ ] Microphone working: Test in browser settings

✅ All checked? Then create an issue with debugging info above!
