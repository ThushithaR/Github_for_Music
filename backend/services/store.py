"""
store.py — SQLite Data Layer
Completely upgraded to map the frontend's Clip interface.
"""

import sqlite3
import json
import os
from typing import Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "flowstate.db")


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Create the clips table cleanly. Destroys mock table if it exists."""
    with _connect() as conn:
        conn.execute("DROP TABLE IF EXISTS nodes;") # Drop old schema
        conn.execute("DROP TABLE IF EXISTS clips;")
        conn.execute("""
            CREATE TABLE clips (
                id          TEXT PRIMARY KEY,
                name        TEXT NOT NULL,
                bpm         REAL,
                key         TEXT,
                mood        TEXT,
                instrument  TEXT,
                session     TEXT,
                type        TEXT,
                parent      TEXT,
                children    TEXT DEFAULT '[]',
                duration    TEXT,
                tags        TEXT DEFAULT '[]',
                keyTimeline TEXT DEFAULT '[]',
                created_at  TEXT NOT NULL
            )
        """)
        conn.commit()


def insert_clip(clip: dict) -> None:
    """Insert a completely formatted clip."""
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO clips (
                id, name, bpm, key, mood, instrument, session, type, parent, children, duration, tags, keyTimeline, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                clip["id"],
                clip["name"],
                clip.get("bpm"),
                clip.get("key"),
                clip.get("mood"),
                clip.get("instrument"),
                clip.get("session"),
                clip["type"],
                clip.get("parent"),
                json.dumps(clip.get("children", [])),
                clip.get("duration"),
                json.dumps(clip.get("tags", [])),
                json.dumps(clip.get("keyTimeline", [])),
                clip["created_at"],
            ),
        )
        conn.commit()


def update_clip(clip_id: str, updates: dict) -> None:
    """Update specific fields of a clip."""
    if not updates:
        return
        
    set_clause = ", ".join(f"{k} = ?" for k in updates.keys())
    values = []
    for v in updates.values():
        if isinstance(v, (list, dict)):
            values.append(json.dumps(v))
        else:
            values.append(v)
            
    values.append(clip_id)
    
    with _connect() as conn:
        conn.execute(f"UPDATE clips SET {set_clause} WHERE id = ?", tuple(values))
        conn.commit()


def delete_clip(clip_id: str) -> None:
    with _connect() as conn:
        conn.execute("DELETE FROM clips WHERE id = ?", (clip_id,))
        conn.commit()


def get_all_clips() -> list[dict]:
    with _connect() as conn:
        rows = conn.execute("SELECT * FROM clips ORDER BY datetime(created_at) ASC").fetchall()
    return [_deserialize(dict(r)) for r in rows]


def get_clip(clip_id: str) -> Optional[dict]:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM clips WHERE id = ?", (clip_id,)).fetchone()
    if row is None:
        return None
    return _deserialize(dict(row))


def _deserialize(row: dict) -> dict:
    row["children"] = json.loads(row["children"] or "[]")
    row["tags"] = json.loads(row["tags"] or "[]")
    row["keyTimeline"] = json.loads(row["keyTimeline"] or "[]")
    return row