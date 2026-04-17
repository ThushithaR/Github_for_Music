import sqlite3

conn = sqlite3.connect("database.db", check_same_thread=False)
cursor = conn.cursor()

cursor.execute("""
CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    file TEXT,
    bpm REAL,
    parents TEXT
)
""")

conn.commit()
