import sqlite3
import threading
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "database.db"

conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
DB_LOCK = threading.Lock()


def execute(query, params=()):
    with DB_LOCK:
        return conn.execute(query, params)


def executemany(query, seq_of_params):
    with DB_LOCK:
        return conn.executemany(query, seq_of_params)


def commit():
    with DB_LOCK:
        conn.commit()


def ensure_nodes_schema():
    """Ensure all required columns exist in nodes table."""
    with DB_LOCK:
        # Check if table exists
        cursor = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='nodes'"
        )
        if not cursor.fetchone():
            # Create table
            conn.execute("""
                CREATE TABLE nodes (
                    id TEXT PRIMARY KEY,
                    file TEXT,
                    bpm REAL,
                    parents TEXT,
                    created_at TEXT,
                    duration REAL,
                    musical_key TEXT,
                    mood TEXT
                )
            """)
            conn.commit()
        else:
            # Check which columns exist
            cursor = conn.execute("PRAGMA table_info(nodes)")
            existing_cols = {row[1] for row in cursor.fetchall()}
            required_cols = {
                'id', 'file', 'bpm', 'parents', 'created_at', 'duration', 'musical_key', 'mood'
            }
            
            # Add missing columns
            for col in required_cols:
                if col not in existing_cols:
                    if col == 'created_at':
                        conn.execute(f"ALTER TABLE nodes ADD COLUMN {col} TEXT")
                    elif col == 'duration':
                        conn.execute(f"ALTER TABLE nodes ADD COLUMN {col} REAL")
                    elif col in ('musical_key', 'mood'):
                        conn.execute(f"ALTER TABLE nodes ADD COLUMN {col} TEXT")
                    else:
                        conn.execute(f"ALTER TABLE nodes ADD COLUMN {col} TEXT")
            conn.commit()


# Initialize schema on import
ensure_nodes_schema()
import sqlite3
import threading
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "database.db"

conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
DB_LOCK = threading.Lock()


def execute(query, params=()):
    with DB_LOCK:
        return conn.execute(query, params)


def executemany(query, seq_of_params):
    with DB_LOCK:
        return conn.executemany(query, seq_of_params)


def commit():
    with DB_LOCK:
        conn.commit()

execute("""
CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    file TEXT,
    bpm REAL,
    parents TEXT,
    created_at TEXT,
    duration REAL,
    musical_key TEXT,
    mood TEXT
)
""")


def ensure_nodes_schema():
    existing_columns = {
        row[1] for row in execute("PRAGMA table_info(nodes)").fetchall()
    }

    if "created_at" not in existing_columns:
        execute("ALTER TABLE nodes ADD COLUMN created_at TEXT")
    if "duration" not in existing_columns:
        execute("ALTER TABLE nodes ADD COLUMN duration REAL")
    if "musical_key" not in existing_columns:
        execute("ALTER TABLE nodes ADD COLUMN musical_key TEXT")
    if "mood" not in existing_columns:
        execute("ALTER TABLE nodes ADD COLUMN mood TEXT")


ensure_nodes_schema()

commit()
