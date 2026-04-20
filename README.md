# FlowState

### AI-Driven Ambient Capture & Version Control for Musicians

FlowState is a near-zero friction system that captures musical ideas as they happen and organizes them into a version-controlled graph — similar to Git, but designed for creative workflows.

Instead of losing ideas in scattered voice notes, FlowState continuously buffers audio, detects meaningful input, and turns it into structured, searchable, and evolvable fragments.

---

---

## Deployment

The application (a slightly older version) is deployed and accessible here:

**https://github-for-music.onrender.com/**

---
## Running Locally

### Backend

```
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

1. Make sure `ffmpeg` is installed on your system.
2. Please make use of an API key from **https://aistudio.google.com/** to make use of the semantic addressing feature of recorded audio clips.
---
Use this link for a tutorial on how to install `ffmpeg`: **https://youtu.be/JR36oH35Fgg?si=6KanfIbI4freoG86**

### Frontend

```
cd frontend
npm install
npm run dev

## The Problem Being Solved

Traditional recording workflows break creative flow:

* Opening a DAW takes time
* Ideas are lost before recording starts
* Voice memos become unorganized archives
* There is no versioning system for creative ideas

FlowState solves this by acting as an **ambient capture + version control layer for music**.

---

## Core Features

### 1. Ambient Capture

* Rolling audio buffer (30–60 seconds)
* Voice Activity Detection (VAD) or manual trigger
* Retrospective recording — save what just happened

### 2. Semantic Indexing

* Extracts:

  * BPM
  * Mood
  * Key (basic placeholder)
* Enables search and structured organization

### 3. Idea Versioning (Git for Music)

* Each recording becomes a **node**
* Nodes can:

  * Branch (variations)
  * Merge (combine ideas)
* Graph-based structure (DAG)

### 4. Evolution Map

* Visual graph of musical ideas
* Tracks how a fragment evolves over time

---

## Architecture

<img width="1807" height="821" alt="architecture" src="https://github.com/user-attachments/assets/df750ab8-4e42-4853-868a-d55c732f0a5f" />

```
Frontend (Next.js)
  ├── Capture UI (buffer + trigger)
  ├── Graph View (React Flow)
  └── API routes

Backend (FastAPI)
  ├── Audio processing (ffmpeg)
  ├── Analysis (librosa)
  ├── Storage (SQLite + hashed blobs)
  └── Graph logic (nodes + edges)
```

---

## Project Structure

```
/
├── backend/
│   ├── main.py
│   ├── services/
│   │   ├── audio.py
│   │   ├── analyze.py
│   │   ├── store.py
│   ├── assets/
│   │   └── blobs/
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── utils/
│
├── .gitignore
└── README.md
```

---

## How It Works

1. Audio is captured using a rolling buffer in the browser
2. User triggers capture (manual or VAD)
3. Audio is sent to backend
4. Backend:

   * Converts to WAV (ffmpeg)
   * Hashes and stores audio
   * Extracts metadata (librosa)
   * Creates a node in SQLite
5. Nodes form a directed acyclic graph
6. Users can branch or merge ideas

---

## API Endpoints

### `POST /capture`

Capture a new audio fragment

### `POST /branch`

Create a variation from an existing node

### `POST /merge`

Combine two nodes into a new one

### `GET /graph`

Returns nodes and edges for visualization

---

## Security Considerations

* File size limits on uploads
* Controlled audio processing via ffmpeg
* No direct file system exposure
* Temporary and generated files excluded from version control

---

## Future Improvements

* Better key detection
* Real-time collaboration
* User authentication
* Advanced search (natural language)
* DAW integration

---

## Inspiration

FlowState is inspired by:

* Git version control systems
* Creative flow-state theory
* The need for frictionless idea capture in music

---

## Demo Flow

1. Record or capture a sound
2. Save it as a node
3. Create variations (branch)
4. Merge ideas
5. Explore the evolution graph

---

## Tech Stack

* Frontend: Next.js, React, React Flow
* Backend: FastAPI
* Audio Processing: ffmpeg, librosa
* Storage: SQLite + file-based blobs

---

## Authors

Built during a hackathon project exploring creative AI systems and human-centered tooling.

---
