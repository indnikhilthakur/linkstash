# LinkStash - PRD

## Overview
Smart link & note-taking mobile app for quickly saving links from YouTube, Instagram, and other platforms with AI-powered metadata extraction.

## Core Features
- **Quick Link Capture**: Paste URL → AI auto-extracts title, thumbnail, summary & tags
- **Voice-to-Note**: Record voice → Whisper transcription → auto-tagging
- **Screenshot OCR**: Pick image → GPT vision extracts text → auto-tags
- **Quick Text**: Type anything → AI generates summary & tags
- **AI Semantic Search**: Natural language search across all notes
- **Masonry Grid**: Pinterest-style visual cards with thumbnails & tags
- **Tag Filtering**: Filter notes by AI-generated tags
- **Export/Import Backup**: JSON file backup & restore
- **Google Auth**: Emergent-managed Google OAuth login

## Tech Stack
- **Frontend**: Expo React Native (SDK 54), Expo Router, TypeScript
- **Backend**: FastAPI, Python
- **Database**: MongoDB (motor async driver)
- **AI**: OpenAI GPT-4.1-mini (via Emergent LLM Key) for summarization/tagging/search
- **STT**: OpenAI Whisper (via Emergent LLM Key) for voice transcription
- **Auth**: Emergent-managed Google OAuth

## API Endpoints
- `POST /api/auth/session` - Exchange Google auth session
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout
- `POST /api/notes` - Create note (link/text/voice/image)
- `GET /api/notes` - List notes with tag filter
- `GET /api/notes/{id}` - Get note detail
- `DELETE /api/notes/{id}` - Delete note
- `POST /api/notes/search` - AI semantic search
- `GET /api/backup/export` - Export all notes
- `POST /api/backup/import` - Import notes

## Design
- Dark mode (#09090B background, #CCFF00 acid lime accents)
- Masonry 2-column grid layout
- Feather icons from @expo/vector-icons

## Future Enhancements (v2)
- Cloud sync with MongoDB Atlas
- Share extension for direct capture from other apps
- Browser extension for desktop
- Collaborative note sharing
- Full vector embeddings with cosine similarity search
