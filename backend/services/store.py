"""
store.py — SQLite DAG layer
All database operations live here. No ORM — raw sqlite3 for simplicity.
The DAG is encoded entirely in the parents column (JSON array of node IDs).

Schema note:
- blob_hash is the canonical primary key.
- id is no longer a persisted column; callers can still use dict["id"]
  because we expose id = blob_hash at read time for compatibility.
"""

import json
import os
import sqlite3
from datetime import datetime, timezone
from typing import Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "flowstate.db")


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def init_db() -> None:
    """Create or migrate the nodes table to the latest schema."""
    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS nodes (
                blob_hash      TEXT PRIMARY KEY,
                label          TEXT NOT NULL DEFAULT '',
                user_filename  TEXT NOT NULL DEFAULT '',
                bpm            REAL,
                key            TEXT,
                mood           TEXT,
                parents        TEXT NOT NULL DEFAULT '[]',
                created_at     TEXT NOT NULL
            )
            """
        )

        cols = {
            row[1]
            for row in conn.execute("PRAGMA table_info(nodes)").fetchall()
        }

        needs_rebuild = ("id" in cols) or ("user_filename" not in cols)
        if needs_rebuild:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS nodes_new (
                    blob_hash      TEXT PRIMARY KEY,
                    label          TEXT NOT NULL DEFAULT '',
                    user_filename  TEXT NOT NULL DEFAULT '',
                    bpm            REAL,
                    key            TEXT,
                    mood           TEXT,
                    parents        TEXT NOT NULL DEFAULT '[]',
                    created_at     TEXT NOT NULL
                )
                """
            )

            conn.execute(
                """
                INSERT OR IGNORE INTO nodes_new (
                    blob_hash, label, user_filename, bpm, key, mood, parents, created_at
                )
                SELECT
                    COALESCE(NULLIF(blob_hash, ''), id),
                    COALESCE(label, ''),
                    '',
                    bpm,
                    key,
                    mood,
                    COALESCE(parents, '[]'),
                    COALESCE(created_at, ?)
                FROM nodes
                WHERE COALESCE(NULLIF(blob_hash, ''), id) IS NOT NULL
                """,
                (_now_iso(),),
            )

            conn.execute("DROP TABLE nodes")
            conn.execute("ALTER TABLE nodes_new RENAME TO nodes")

        conn.commit()


def insert_node(
    blob_hash: str,
    label: str,
    user_filename: str,
    bpm: Optional[float],
    key: Optional[str],
    mood: Optional[str],
    parents: list[str],
    created_at: str,
) -> None:
    """Insert or update node keyed by blob hash."""
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO nodes (blob_hash, label, user_filename, bpm, key, mood, parents, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(blob_hash) DO UPDATE SET
                label = excluded.label,
                user_filename = excluded.user_filename,
                bpm = excluded.bpm,
                key = excluded.key,
                mood = excluded.mood,
                parents = excluded.parents,
                created_at = excluded.created_at
            """,
            (
                blob_hash,
                label,
                user_filename,
                bpm,
                key,
                mood,
                json.dumps(parents),
                created_at,
            ),
        )
        conn.commit()


def get_node(node_id: str) -> Optional[dict]:
    """Fetch a single node by hash (or id alias)."""
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM nodes WHERE blob_hash = ?", (node_id,)
        ).fetchone()
    if row is None:
        return None
    return _deserialize(dict(row))


def get_all_nodes() -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM nodes ORDER BY created_at ASC"
        ).fetchall()
    return [_deserialize(dict(r)) for r in rows]


def search_nodes(q: str) -> list[dict]:
    """
    Simple LIKE search across label, key, mood, and user filename.
    q can be a multi-word phrase — each word is matched independently (AND logic).
    """
    words = q.strip().split()
    if not words:
        return get_all_nodes()

    clauses = []
    params = []
    for word in words:
        like = f"%{word}%"
        clauses.append("(label LIKE ? OR key LIKE ? OR mood LIKE ? OR user_filename LIKE ?)")
        params.extend([like, like, like, like])

    sql = f"SELECT * FROM nodes WHERE {' AND '.join(clauses)} ORDER BY created_at ASC"

    with _connect() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [_deserialize(dict(r)) for r in rows]


def _deserialize(row: dict) -> dict:
    row["parents"] = json.loads(row["parents"])
    # Compatibility aliases for callers expecting id/blob_hash separately.
    row["id"] = row["blob_hash"]
    return row


def build_graph_payload(nodes: list[dict]) -> dict:
    rf_nodes = []
    rf_edges = []

    for i, node in enumerate(nodes):
        rf_nodes.append(
            {
                "id": node["blob_hash"],
                "type": "ideaNode",
                "position": {"x": (i % 5) * 220, "y": (i // 5) * 160},
                "data": {
                    "label": node["label"] or node.get("user_filename") or f"idea {i + 1}",
                    "bpm": node["bpm"],
                    "key": node["key"],
                    "mood": node["mood"],
                    "blob_hash": node["blob_hash"],
                    "user_filename": node.get("user_filename", ""),
                    "created_at": node["created_at"],
                },
            }
        )
        for parent_id in node["parents"]:
            rf_edges.append(
                {
                    "id": f"{parent_id}->{node['blob_hash']}",
                    "source": parent_id,
                    "target": node["blob_hash"],
                    "animated": True,
                }
            )

    return {"nodes": rf_nodes, "edges": rf_edges}
