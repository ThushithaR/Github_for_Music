# test_store.py
from services.store import init_db, insert_node, get_all_nodes

init_db()

insert_node(
    id="test1",
    blob_hash="abc123",
    label="test clip",
    bpm=120,
    key="C",
    mood="happy",
    parents="[]",
    created_at="2026-01-01"
)

nodes = get_all_nodes()
print(nodes)