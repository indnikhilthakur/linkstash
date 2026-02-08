# LinkStash

## Backend (local)
1. Copy `.env.example` to `.env` and fill in required values.
2. Run the API:
   - PowerShell: `backend/run.ps1`
   - Or directly: `uvicorn server:app --reload --host 0.0.0.0 --port 8000`
3. Open FastAPI docs at `http://localhost:8000/docs`
