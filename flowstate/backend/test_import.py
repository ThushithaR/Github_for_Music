try:
    from main import app
    print("SUCCESS: Import OK")
except Exception as e:
    print(f"ERROR: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
