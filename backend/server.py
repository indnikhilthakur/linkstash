from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import json
import tempfile
import base64
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import httpx
from bs4 import BeautifulSoup

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# LLM key
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Pydantic Models ---
class UserOut(BaseModel):
    user_id: str
    email: str
    name: str
    picture: str = ""

class NoteCreate(BaseModel):
    type: str  # link, text, voice, image
    url: Optional[str] = None
    title: Optional[str] = None
    raw_content: Optional[str] = None
    image_base64: Optional[str] = None
    audio_base64: Optional[str] = None

class NoteOut(BaseModel):
    note_id: str
    user_id: str
    type: str
    title: str = ""
    url: str = ""
    summary: str = ""
    tags: List[str] = []
    thumbnail: str = ""
    raw_content: str = ""
    source_platform: str = ""
    is_processing: bool = False
    created_at: str = ""
    updated_at: str = ""

class SearchQuery(BaseModel):
    query: str

class BackupImport(BaseModel):
    notes: List[dict]

# --- Auth Helpers ---
async def get_current_user(request: Request) -> dict:
    token = None
    cookie_token = request.cookies.get("session_token")
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    if not token:
        token = cookie_token
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def detect_platform(url: str) -> str:
    if not url:
        return ""
    url_lower = url.lower()
    if "youtube.com" in url_lower or "youtu.be" in url_lower:
        return "youtube"
    elif "instagram.com" in url_lower:
        return "instagram"
    elif "twitter.com" in url_lower or "x.com" in url_lower:
        return "twitter"
    elif "tiktok.com" in url_lower:
        return "tiktok"
    elif "reddit.com" in url_lower:
        return "reddit"
    elif "linkedin.com" in url_lower:
        return "linkedin"
    elif "github.com" in url_lower:
        return "github"
    elif "medium.com" in url_lower:
        return "medium"
    return "web"

async def scrape_url_metadata(url: str) -> dict:
    """Scrape OG tags and page info from URL"""
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client_http:
            headers = {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            }
            resp = await client_http.get(url, headers=headers)
            soup = BeautifulSoup(resp.text, "html.parser")
            
            title = ""
            description = ""
            thumbnail = ""
            
            # OG tags
            og_title = soup.find("meta", property="og:title")
            og_desc = soup.find("meta", property="og:description")
            og_image = soup.find("meta", property="og:image")
            
            if og_title:
                title = og_title.get("content", "")
            elif soup.title:
                title = soup.title.string or ""
            
            if og_desc:
                description = og_desc.get("content", "")
            else:
                meta_desc = soup.find("meta", attrs={"name": "description"})
                if meta_desc:
                    description = meta_desc.get("content", "")
            
            if og_image:
                thumbnail = og_image.get("content", "")
            
            return {
                "title": title.strip()[:200],
                "description": description.strip()[:500],
                "thumbnail": thumbnail,
            }
    except Exception as e:
        logger.error(f"URL scrape failed: {e}")
        return {"title": "", "description": "", "thumbnail": ""}

async def generate_ai_metadata(title: str, description: str, url: str = "", raw_content: str = "") -> dict:
    """Use GPT to generate summary and tags"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"metadata-{uuid.uuid4().hex[:8]}",
            system_message="You are a metadata extraction assistant. Given content about a link or note, generate a concise summary (2-3 sentences) and 3-5 relevant tags. Respond ONLY in valid JSON format: {\"summary\": \"...\", \"tags\": [\"tag1\", \"tag2\"]}"
        ).with_model("openai", "gpt-4.1-mini")
        
        content_parts = []
        if title:
            content_parts.append(f"Title: {title}")
        if description:
            content_parts.append(f"Description: {description}")
        if url:
            content_parts.append(f"URL: {url}")
        if raw_content:
            content_parts.append(f"Content: {raw_content[:1000]}")
        
        content = "\n".join(content_parts)
        msg = UserMessage(text=f"Generate summary and tags for:\n{content}")
        response = await chat.send_message(msg)
        
        # Parse JSON response
        response_text = response.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
        
        result = json.loads(response_text)
        return {
            "summary": result.get("summary", ""),
            "tags": result.get("tags", [])[:5]
        }
    except Exception as e:
        logger.error(f"AI metadata generation failed: {e}")
        return {"summary": description[:200] if description else "", "tags": []}

async def transcribe_audio(audio_base64: str) -> str:
    """Transcribe audio using Whisper"""
    try:
        from emergentintegrations.llm.openai import OpenAISpeechToText
        
        stt = OpenAISpeechToText(api_key=EMERGENT_LLM_KEY)
        audio_bytes = base64.b64decode(audio_base64)
        
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name
        
        try:
            with open(tmp_path, "rb") as audio_file:
                response = await stt.transcribe(
                    file=audio_file,
                    model="whisper-1",
                    response_format="json"
                )
            return response.text
        finally:
            os.unlink(tmp_path)
    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        return ""

async def extract_image_text(image_base64: str) -> str:
    """Extract text from image using GPT vision"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContent
        
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"ocr-{uuid.uuid4().hex[:8]}",
            system_message="You are an OCR assistant. Extract all readable text and describe the key content from the image. Be concise."
        ).with_model("openai", "gpt-4.1-mini")
        
        file_content = FileContent(
            content_type="image/jpeg",
            file_content_base64=image_base64
        )
        msg = UserMessage(
            text="Extract text and describe key content from this image.",
            file_contents=[file_content]
        )
        response = await chat.send_message(msg)
        return response.strip()
    except Exception as e:
        logger.error(f"Image OCR failed: {e}")
        return ""

# --- Auth Routes ---
@api_router.post("/auth/session")
async def exchange_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    # Exchange session_id with Emergent Auth
    async with httpx.AsyncClient() as client_http:
        auth_resp = await client_http.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        if auth_resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session_id")
        auth_data = auth_resp.json()
    
    email = auth_data.get("email", "")
    name = auth_data.get("name", "")
    picture = auth_data.get("picture", "")
    session_token = auth_data.get("session_token", "")
    
    # Upsert user
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"email": email}, {"$set": {"name": name, "picture": picture}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "created_at": datetime.now(timezone.utc)
        })
    
    # Store session
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)
    })
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 3600
    )
    
    return {"user_id": user_id, "email": email, "name": name, "picture": picture, "session_token": session_token}

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return UserOut(**user)

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"message": "Logged out"}

# --- Notes Routes ---
@api_router.post("/notes")
async def create_note(note_data: NoteCreate, request: Request):
    user = await get_current_user(request)
    user_id = user["user_id"]
    
    note_id = f"note_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    
    note = {
        "note_id": note_id,
        "user_id": user_id,
        "type": note_data.type,
        "title": note_data.title or "",
        "url": note_data.url or "",
        "summary": "",
        "tags": [],
        "thumbnail": "",
        "raw_content": note_data.raw_content or "",
        "source_platform": detect_platform(note_data.url or ""),
        "is_processing": True,
        "created_at": now,
        "updated_at": now,
    }
    
    await db.notes.insert_one(note)
    # Remove _id before returning
    note.pop("_id", None)
    
    # Process metadata asynchronously (but we do it inline for simplicity)
    try:
        if note_data.type == "link" and note_data.url:
            # Scrape URL metadata
            metadata = await scrape_url_metadata(note_data.url)
            if not note["title"] and metadata["title"]:
                note["title"] = metadata["title"]
            note["thumbnail"] = metadata["thumbnail"]
            
            # AI summary and tags
            ai_data = await generate_ai_metadata(
                metadata["title"], metadata["description"], note_data.url
            )
            note["summary"] = ai_data["summary"]
            note["tags"] = ai_data["tags"]
            
        elif note_data.type == "voice" and note_data.audio_base64:
            # Transcribe audio
            transcription = await transcribe_audio(note_data.audio_base64)
            note["raw_content"] = transcription
            if not note["title"]:
                note["title"] = transcription[:60] + ("..." if len(transcription) > 60 else "")
            
            # AI summary and tags
            ai_data = await generate_ai_metadata("", "", "", transcription)
            note["summary"] = ai_data["summary"]
            note["tags"] = ai_data["tags"]
            
        elif note_data.type == "image" and note_data.image_base64:
            # OCR
            extracted_text = await extract_image_text(note_data.image_base64)
            note["raw_content"] = extracted_text
            if not note["title"]:
                note["title"] = extracted_text[:60] + ("..." if len(extracted_text) > 60 else "")
            
            # AI summary and tags
            ai_data = await generate_ai_metadata("", "", "", extracted_text)
            note["summary"] = ai_data["summary"]
            note["tags"] = ai_data["tags"]
            
        elif note_data.type == "text" and note_data.raw_content:
            if not note["title"]:
                note["title"] = note_data.raw_content[:60] + ("..." if len(note_data.raw_content) > 60 else "")
            
            # AI summary and tags
            ai_data = await generate_ai_metadata("", "", "", note_data.raw_content)
            note["summary"] = ai_data["summary"]
            note["tags"] = ai_data["tags"]
        
        note["is_processing"] = False
        note["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        await db.notes.update_one(
            {"note_id": note_id},
            {"$set": {k: v for k, v in note.items() if k != "note_id"}}
        )
    except Exception as e:
        logger.error(f"Note processing error: {e}")
        await db.notes.update_one(
            {"note_id": note_id},
            {"$set": {"is_processing": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    note.pop("_id", None)
    return NoteOut(**note)

@api_router.get("/notes")
async def list_notes(request: Request, tag: Optional[str] = None, page: int = 1, limit: int = 50):
    user = await get_current_user(request)
    query = {"user_id": user["user_id"]}
    if tag:
        query["tags"] = tag
    
    skip = (page - 1) * limit
    cursor = db.notes.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit)
    notes = await cursor.to_list(limit)
    total = await db.notes.count_documents(query)
    
    return {"notes": notes, "total": total, "page": page}

@api_router.get("/notes/{note_id}")
async def get_note(note_id: str, request: Request):
    user = await get_current_user(request)
    note = await db.notes.find_one(
        {"note_id": note_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note

@api_router.delete("/notes/{note_id}")
async def delete_note(note_id: str, request: Request):
    user = await get_current_user(request)
    result = await db.notes.delete_one({"note_id": note_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"message": "Note deleted"}

@api_router.post("/notes/search")
async def search_notes(search: SearchQuery, request: Request):
    user = await get_current_user(request)
    user_id = user["user_id"]
    query_text = search.query.strip()
    
    if not query_text:
        return {"notes": []}
    
    # First, do a text-based search
    regex_pattern = {"$regex": query_text, "$options": "i"}
    text_results = await db.notes.find(
        {
            "user_id": user_id,
            "$or": [
                {"title": regex_pattern},
                {"summary": regex_pattern},
                {"tags": regex_pattern},
                {"raw_content": regex_pattern},
                {"url": regex_pattern},
                {"source_platform": regex_pattern},
            ]
        },
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    if text_results:
        return {"notes": text_results}
    
    # If no text results, use AI semantic search
    try:
        all_notes = await db.notes.find(
            {"user_id": user_id}, {"_id": 0}
        ).sort("created_at", -1).to_list(200)
        
        if not all_notes:
            return {"notes": []}
        
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        # Build notes summary for AI
        notes_summary = []
        for i, n in enumerate(all_notes):
            notes_summary.append(f"{i}: {n.get('title','')} | {n.get('summary','')} | tags: {','.join(n.get('tags',[]))}")
        
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"search-{uuid.uuid4().hex[:8]}",
            system_message="You are a search assistant. Given a user query and a list of notes, return the indices of the most relevant notes. Respond ONLY with a JSON array of indices like [0, 3, 5]. If none match, return []."
        ).with_model("openai", "gpt-4.1-mini")
        
        msg = UserMessage(
            text=f"Query: {query_text}\n\nNotes:\n" + "\n".join(notes_summary[:50])
        )
        response = await chat.send_message(msg)
        
        response_text = response.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
        
        indices = json.loads(response_text)
        results = [all_notes[i] for i in indices if 0 <= i < len(all_notes)]
        return {"notes": results}
    except Exception as e:
        logger.error(f"AI search failed: {e}")
        return {"notes": []}

# --- Backup Routes ---
@api_router.get("/backup/export")
async def export_backup(request: Request):
    user = await get_current_user(request)
    notes = await db.notes.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).to_list(10000)
    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "user_id": user["user_id"],
        "count": len(notes),
        "notes": notes
    }

@api_router.post("/backup/import")
async def import_backup(backup: BackupImport, request: Request):
    user = await get_current_user(request)
    user_id = user["user_id"]
    
    imported = 0
    for note_data in backup.notes:
        note_data["user_id"] = user_id
        if "note_id" not in note_data:
            note_data["note_id"] = f"note_{uuid.uuid4().hex[:12]}"
        
        # Check if note already exists
        existing = await db.notes.find_one({"note_id": note_data["note_id"]}, {"_id": 0})
        if existing:
            continue
        
        note_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.notes.insert_one(note_data)
        imported += 1
    
    return {"message": f"Imported {imported} notes", "imported": imported}

# --- Metadata Route ---
@api_router.post("/metadata/extract")
async def extract_metadata(request: Request):
    user = await get_current_user(request)
    body = await request.json()
    url = body.get("url", "")
    if not url:
        raise HTTPException(status_code=400, detail="URL required")
    
    metadata = await scrape_url_metadata(url)
    ai_data = await generate_ai_metadata(metadata["title"], metadata["description"], url)
    
    return {
        **metadata,
        "summary": ai_data["summary"],
        "tags": ai_data["tags"],
        "source_platform": detect_platform(url)
    }

@api_router.get("/")
async def root():
    return {"message": "LinkStash API"}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
