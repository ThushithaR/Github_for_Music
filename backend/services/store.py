"""
store.py — SQLite DAG layer
All database operations live here. No ORM — raw sqlite3 for simplicity.
The DAG is encoded entirely in the parents column (JSON array of node IDs).
"""

import sqlite3
import json
import os
from typing import Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "flowstate.db")


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # rows behave like dicts
    return conn


def init_db() -> None:
    """Create the nodes table if it doesn't exist. Called once on startup."""
    with _connect() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS nodes (
                id          TEXT PRIMARY KEY,
                blob_hash   TEXT NOT NULL,
                label       TEXT NOT NULL DEFAULT '',
                bpm         REAL,
                key         TEXT,
                mood        TEXT,
                parents     TEXT NOT NULL DEFAULT '[]',
                created_at  TEXT NOT NULL
            )
        """)
        conn.commit()


def insert_node(
    id: str,
    blob_hash: str,
    label: str,
    bpm: Optional[float],
    key: Optional[str],
    mood: Optional[str],
    parents: list[str],
    created_at: str,
) -> None:
    """Insert a new node. parents is a list of node ID strings."""
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO nodes (id, blob_hash, label, bpm, key, mood, parents, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (id, blob_hash, label, bpm, key, mood, json.dumps(parents), created_at),
        )
        conn.commit()


def get_node(node_id: str) -> Optional[dict]:
    """Fetch a single node by ID. Returns None if not found."""
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM nodes WHERE id = ?", (node_id,)
        ).fetchone()
    if row is None:
        return None
    return _deserialize(dict(row))


def get_all_nodes() -> list[dict]:
    """Return all nodes. Used by GET /graph to build the DAG payload."""
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM nodes ORDER BY created_at ASC"
        ).fetchall()
    return [_deserialize(dict(r)) for r in rows]


def search_nodes(q: str) -> list[dict]:
    """
    Simple LIKE search across label, key, and mood.
    q can be a multi-word phrase — each word is matched independently (AND logic).
    """
    words = q.strip().split()
    if not words:
        return get_all_nodes()

    # Build: WHERE (label LIKE ? OR key LIKE ? OR mood LIKE ?) AND (...) AND ...
    clauses = []
    params = []
    for word in words:
        like = f"%{word}%"
        clauses.append("(label LIKE ? OR key LIKE ? OR mood LIKE ?)")
        params.extend([like, like, like])

    sql = f"SELECT * FROM nodes WHERE {' AND '.join(clauses)} ORDER BY created_at ASC"

    with _connect() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [_deserialize(dict(r)) for r in rows]


def _deserialize(row: dict) -> dict:
    """Parse the JSON parents field back into a Python list."""
    row["parents"] = json.loads(row["parents"])
    return row


def build_graph_payload(nodes: list[dict]) -> dict:
    """
    Transform flat node list into {nodes, edges} structure
    that React Flow can consume directly.

    React Flow node shape:  {id, data: {label, bpm, key, mood, blob_hash}, position}
    React Flow edge shape:  {id, source, target}
    Positions are staggered — the frontend will auto-layout via dagre anyway.
    """
    rf_nodes = []
    rf_edges = []

    for i, node in enumerate(nodes):
        rf_nodes.append({
            "id": node["id"],
            "type": "ideaNode",             # custom node type on frontend
            "position": {"x": (i % 5) * 220, "y": (i // 5) * 160},
            "data": {
                "label":     node["label"] or f"idea {i + 1}",
                "bpm":       node["bpm"],
                "key":       node["key"],
                "mood":      node["mood"],
                "blob_hash": node["blob_hash"],
                "created_at": node["created_at"],
            },
        })
        # one edge per parent → child relationship
        for parent_id in node["parents"]:
            rf_edges.append({
                "id":     f"{parent_id}->{node['id']}",
                "source": parent_id,
                "target": node["id"],
                "animated": True,
            })

    return {"nodes": rf_nodes, "edges": rf_edges}