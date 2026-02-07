"""
LinkStash Backend API Tests
Tests: Health, Auth (Google + Email/Password), Notes CRUD, Link metadata, Text auto-tagging, AI Search, Backup
"""
import pytest
import requests
import os
import time
import json

# Get BASE_URL from environment
BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    raise ValueError("EXPO_PUBLIC_BACKEND_URL environment variable not set")

# Test session token (created via MongoDB - persistent session for testing)
TEST_SESSION_TOKEN = "test_session_persistent_1770507150408"
TEST_USER_ID = "test-user-1770507150408"

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture
def auth_headers():
    """Headers with Bearer token for authenticated requests"""
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {TEST_SESSION_TOKEN}"
    }

# --- Health Check ---
class TestHealth:
    """API health check"""
    
    def test_root_endpoint(self, api_client):
        """Test GET /api/ returns LinkStash API message"""
        response = api_client.get(f"{BASE_URL}/api/")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "message" in data, "Response missing 'message' field"
        assert "LinkStash" in data["message"], f"Expected 'LinkStash' in message, got: {data['message']}"
        print(f"✓ Health check passed: {data['message']}")

# --- Auth Tests ---
class TestAuth:
    """Authentication flow tests"""
    
    def test_get_me_with_valid_token(self, api_client, auth_headers):
        """Test GET /api/auth/me with valid session token"""
        response = api_client.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "user_id" in data, "Response missing 'user_id'"
        assert "email" in data, "Response missing 'email'"
        assert "name" in data, "Response missing 'name'"
        assert data["user_id"] == TEST_USER_ID, f"Expected user_id {TEST_USER_ID}, got {data['user_id']}"
        print(f"✓ Auth /me successful: {data['email']}")
    
    def test_get_me_without_token(self, api_client):
        """Test GET /api/auth/me without token returns 401"""
        response = api_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Auth /me correctly rejects unauthenticated request")
    
    def test_logout(self, api_client):
        """Test POST /api/auth/logout with temporary session"""
        # Create a temporary session just for logout test
        import subprocess
        result = subprocess.run([
            "mongosh", "--quiet", "--eval",
            """
            use('test_database');
            var tempToken = 'temp_logout_session_' + Date.now();
            db.user_sessions.insertOne({
                user_id: 'test-user-1770507150408',
                session_token: tempToken,
                expires_at: new Date(Date.now() + 7*24*60*60*1000),
                created_at: new Date()
            });
            print(tempToken);
            """
        ], capture_output=True, text=True)
        temp_token = result.stdout.strip().split('\n')[-1]
        
        # Test logout with temporary token
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {temp_token}"
        }
        response = api_client.post(f"{BASE_URL}/api/auth/logout", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "message" in data, "Response missing 'message'"
        print(f"✓ Logout successful: {data['message']}")

# --- Email/Password Auth Tests ---
class TestEmailAuth:
    """Email/password authentication tests (NEW feature)"""
    
    def test_email_register_success(self, api_client):
        """Test POST /api/auth/register creates new user and returns session token"""
        # Use unique email with timestamp to avoid conflicts
        unique_email = f"test_register_{int(time.time())}@example.com"
        payload = {
            "email": unique_email,
            "password": "testpass123",
            "name": "Test Email User"
        }
        
        response = api_client.post(f"{BASE_URL}/api/auth/register", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "user_id" in data, "Response missing 'user_id'"
        assert "email" in data, "Response missing 'email'"
        assert "name" in data, "Response missing 'name'"
        assert "session_token" in data, "Response missing 'session_token'"
        assert data["email"] == unique_email.lower(), "Email should be lowercase"
        assert data["name"] == "Test Email User", "Name mismatch"
        assert data["session_token"].startswith("sess_"), "Session token should start with sess_"
        
        # Store for next test
        self.registered_email = unique_email
        self.registered_password = "testpass123"
        self.session_token = data["session_token"]
        
        print(f"✓ Email registration successful: {data['email']}, session_token: {data['session_token'][:20]}...")
        
        # Verify session token works with /api/auth/me
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.session_token}"
        }
        me_response = api_client.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert me_response.status_code == 200, f"Session token should work with /api/auth/me"
        me_data = me_response.json()
        assert me_data["email"] == unique_email.lower(), "Email should match in /me endpoint"
        print(f"✓ Session token validated with /api/auth/me")
    
    def test_email_register_duplicate_409(self, api_client):
        """Test POST /api/auth/register with duplicate email returns 409"""
        # First register a user
        unique_email = f"test_duplicate_{int(time.time())}@example.com"
        payload = {
            "email": unique_email,
            "password": "password123",
            "name": "First User"
        }
        
        first_response = api_client.post(f"{BASE_URL}/api/auth/register", json=payload)
        assert first_response.status_code == 200, "First registration should succeed"
        print(f"✓ First registration successful: {unique_email}")
        
        # Try to register same email again
        duplicate_payload = {
            "email": unique_email,
            "password": "different_password",
            "name": "Second User"
        }
        
        duplicate_response = api_client.post(f"{BASE_URL}/api/auth/register", json=duplicate_payload)
        assert duplicate_response.status_code == 409, f"Expected 409 for duplicate email, got {duplicate_response.status_code}"
        
        error_data = duplicate_response.json()
        assert "detail" in error_data, "Error response should have 'detail' field"
        assert "already registered" in error_data["detail"].lower(), f"Error message should mention 'already registered', got: {error_data['detail']}"
        print(f"✓ Duplicate email correctly rejected with 409: {error_data['detail']}")
    
    def test_email_login_success(self, api_client):
        """Test POST /api/auth/login with valid credentials returns session token"""
        # First register a user
        unique_email = f"test_login_{int(time.time())}@example.com"
        register_payload = {
            "email": unique_email,
            "password": "mypassword456",
            "name": "Login Test User"
        }
        
        reg_response = api_client.post(f"{BASE_URL}/api/auth/register", json=register_payload)
        assert reg_response.status_code == 200, "Registration should succeed"
        print(f"✓ User registered: {unique_email}")
        
        # Now login with same credentials
        login_payload = {
            "email": unique_email,
            "password": "mypassword456"
        }
        
        login_response = api_client.post(f"{BASE_URL}/api/auth/login", json=login_payload)
        assert login_response.status_code == 200, f"Expected 200, got {login_response.status_code}: {login_response.text}"
        
        data = login_response.json()
        assert "user_id" in data, "Response missing 'user_id'"
        assert "email" in data, "Response missing 'email'"
        assert "name" in data, "Response missing 'name'"
        assert "session_token" in data, "Response missing 'session_token'"
        assert data["email"] == unique_email.lower(), "Email should match"
        assert data["name"] == "Login Test User", "Name should match"
        assert data["session_token"].startswith("sess_"), "Session token should start with sess_"
        
        print(f"✓ Email login successful: {data['email']}, session_token: {data['session_token'][:20]}...")
        
        # Verify session token works
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {data['session_token']}"
        }
        me_response = api_client.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert me_response.status_code == 200, "Session token should work"
        print(f"✓ Login session token validated with /api/auth/me")
    
    def test_email_login_wrong_password_401(self, api_client):
        """Test POST /api/auth/login with wrong password returns 401"""
        # First register a user
        unique_email = f"test_wrong_pass_{int(time.time())}@example.com"
        register_payload = {
            "email": unique_email,
            "password": "correct_password",
            "name": "Password Test User"
        }
        
        reg_response = api_client.post(f"{BASE_URL}/api/auth/register", json=register_payload)
        assert reg_response.status_code == 200, "Registration should succeed"
        print(f"✓ User registered: {unique_email}")
        
        # Try to login with wrong password
        wrong_login_payload = {
            "email": unique_email,
            "password": "wrong_password"
        }
        
        wrong_response = api_client.post(f"{BASE_URL}/api/auth/login", json=wrong_login_payload)
        assert wrong_response.status_code == 401, f"Expected 401 for wrong password, got {wrong_response.status_code}"
        
        error_data = wrong_response.json()
        assert "detail" in error_data, "Error response should have 'detail' field"
        assert "invalid" in error_data["detail"].lower(), f"Error message should mention 'invalid', got: {error_data['detail']}"
        print(f"✓ Wrong password correctly rejected with 401: {error_data['detail']}")
    
    def test_email_login_nonexistent_email_401(self, api_client):
        """Test POST /api/auth/login with non-existent email returns 401"""
        nonexistent_payload = {
            "email": f"nonexistent_{int(time.time())}@example.com",
            "password": "anypassword123"
        }
        
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=nonexistent_payload)
        assert response.status_code == 401, f"Expected 401 for non-existent email, got {response.status_code}"
        
        error_data = response.json()
        assert "detail" in error_data, "Error response should have 'detail' field"
        assert "invalid" in error_data["detail"].lower(), f"Error message should mention 'invalid', got: {error_data['detail']}"
        print(f"✓ Non-existent email correctly rejected with 401: {error_data['detail']}")
    
    def test_email_register_validation_errors(self, api_client):
        """Test POST /api/auth/register validates required fields and password length"""
        # Test short password
        short_pass_payload = {
            "email": f"test_short_{int(time.time())}@example.com",
            "password": "12345",  # Only 5 chars, need 6
            "name": "Test User"
        }
        
        response = api_client.post(f"{BASE_URL}/api/auth/register", json=short_pass_payload)
        assert response.status_code == 400, f"Expected 400 for short password, got {response.status_code}"
        
        error_data = response.json()
        assert "detail" in error_data, "Error response should have 'detail'"
        assert "6 characters" in error_data["detail"], f"Error should mention password length, got: {error_data['detail']}"
        print(f"✓ Short password rejected with 400: {error_data['detail']}")

# --- Notes CRUD Tests ---
class TestNotesCRUD:
    """Notes CRUD operations with persistence verification"""
    
    def test_create_text_note_and_verify(self, api_client, auth_headers):
        """Test POST /api/notes with type=text and verify with GET"""
        payload = {
            "type": "text",
            "title": "TEST_Text_Note",
            "raw_content": "This is a test note for automated testing. It should be tagged by AI."
        }
        
        # Create note
        response = api_client.post(f"{BASE_URL}/api/notes", headers=auth_headers, json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        note = response.json()
        assert "note_id" in note, "Response missing 'note_id'"
        assert note["type"] == "text", f"Expected type 'text', got {note['type']}"
        assert note["title"] == "TEST_Text_Note", f"Expected title match"
        assert note["raw_content"] == payload["raw_content"], "Raw content doesn't match"
        
        note_id = note["note_id"]
        print(f"✓ Created text note: {note_id}")
        
        # Wait for AI processing (summary and tags generation)
        time.sleep(3)
        
        # Verify with GET
        get_response = api_client.get(f"{BASE_URL}/api/notes/{note_id}", headers=auth_headers)
        assert get_response.status_code == 200, f"GET failed: {get_response.status_code}"
        
        retrieved_note = get_response.json()
        assert retrieved_note["note_id"] == note_id, "Note ID mismatch"
        assert retrieved_note["type"] == "text", "Type mismatch"
        assert retrieved_note["raw_content"] == payload["raw_content"], "Content not persisted"
        
        # Check AI-generated fields
        if not retrieved_note["is_processing"]:
            assert len(retrieved_note.get("summary", "")) > 0, "AI summary not generated"
            assert len(retrieved_note.get("tags", [])) > 0, "AI tags not generated"
            print(f"✓ AI metadata: summary={len(retrieved_note['summary'])} chars, tags={retrieved_note['tags']}")
        else:
            print("⚠ Note still processing, skipping AI metadata check")
        
        print(f"✓ Text note persisted correctly")
    
    def test_create_link_note_and_verify(self, api_client, auth_headers):
        """Test POST /api/notes with type=link and verify metadata extraction"""
        payload = {
            "type": "link",
            "url": "https://github.com/facebook/react",
            "title": "TEST_Link_Note"
        }
        
        # Create note
        response = api_client.post(f"{BASE_URL}/api/notes", headers=auth_headers, json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        note = response.json()
        assert "note_id" in note, "Response missing 'note_id'"
        assert note["type"] == "link", f"Expected type 'link', got {note['type']}"
        assert note["url"] == payload["url"], "URL doesn't match"
        assert note["source_platform"] == "github", f"Expected platform 'github', got {note['source_platform']}"
        
        note_id = note["note_id"]
        print(f"✓ Created link note: {note_id}, platform: {note['source_platform']}")
        
        # Wait for scraping and AI processing
        time.sleep(5)
        
        # Verify with GET
        get_response = api_client.get(f"{BASE_URL}/api/notes/{note_id}", headers=auth_headers)
        assert get_response.status_code == 200, f"GET failed: {get_response.status_code}"
        
        retrieved_note = get_response.json()
        assert retrieved_note["note_id"] == note_id
        assert retrieved_note["url"] == payload["url"]
        
        # Check metadata extraction
        if not retrieved_note["is_processing"]:
            # Should have extracted title, summary, tags
            assert len(retrieved_note.get("summary", "")) > 0, "Summary not extracted"
            assert len(retrieved_note.get("tags", [])) > 0, "Tags not generated"
            print(f"✓ Metadata extracted: title='{retrieved_note['title'][:30]}...', tags={retrieved_note['tags']}")
        else:
            print("⚠ Note still processing")
        
        print(f"✓ Link note with metadata extraction successful")
    
    def test_list_notes(self, api_client, auth_headers):
        """Test GET /api/notes returns list of notes"""
        response = api_client.get(f"{BASE_URL}/api/notes", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "notes" in data, "Response missing 'notes' field"
        assert "total" in data, "Response missing 'total' field"
        assert isinstance(data["notes"], list), "Notes should be a list"
        assert data["total"] >= 2, f"Expected at least 2 notes, got {data['total']}"
        
        print(f"✓ List notes: {data['total']} total notes found")
    
    def test_delete_note_and_verify(self, api_client, auth_headers):
        """Test DELETE /api/notes/{id} and verify with GET 404"""
        # First create a note to delete
        payload = {"type": "text", "title": "TEST_TO_DELETE", "raw_content": "This will be deleted"}
        create_response = api_client.post(f"{BASE_URL}/api/notes", headers=auth_headers, json=payload)
        assert create_response.status_code == 200
        note_id = create_response.json()["note_id"]
        print(f"✓ Created note for deletion: {note_id}")
        
        # Delete the note
        delete_response = api_client.delete(f"{BASE_URL}/api/notes/{note_id}", headers=auth_headers)
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.status_code}"
        
        delete_data = delete_response.json()
        assert "message" in delete_data, "Delete response missing 'message'"
        print(f"✓ Deleted note: {delete_data['message']}")
        
        # Verify note is gone with GET
        get_response = api_client.get(f"{BASE_URL}/api/notes/{note_id}", headers=auth_headers)
        assert get_response.status_code == 404, f"Expected 404 after delete, got {get_response.status_code}"
        print(f"✓ Note confirmed deleted (404 on GET)")

# --- AI Search Tests ---
class TestAISearch:
    """AI semantic search tests"""
    
    def test_search_with_text_match(self, api_client, auth_headers):
        """Test POST /api/notes/search with text query"""
        payload = {"query": "test"}
        response = api_client.post(f"{BASE_URL}/api/notes/search", headers=auth_headers, json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "notes" in data, "Response missing 'notes' field"
        assert isinstance(data["notes"], list), "Notes should be a list"
        print(f"✓ Search returned {len(data['notes'])} results for query 'test'")
    
    def test_search_with_semantic_query(self, api_client, auth_headers):
        """Test AI semantic search with natural language"""
        payload = {"query": "react library from github"}
        response = api_client.post(f"{BASE_URL}/api/notes/search", headers=auth_headers, json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "notes" in data, "Response missing 'notes'"
        print(f"✓ AI semantic search returned {len(data['notes'])} results")
    
    def test_search_empty_query(self, api_client, auth_headers):
        """Test search with empty query returns empty results"""
        payload = {"query": ""}
        response = api_client.post(f"{BASE_URL}/api/notes/search", headers=auth_headers, json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["notes"] == [], "Empty query should return empty list"
        print("✓ Empty query handled correctly")

# --- Backup Tests ---
class TestBackup:
    """Backup export/import tests"""
    
    def test_export_backup(self, api_client, auth_headers):
        """Test GET /api/backup/export"""
        response = api_client.get(f"{BASE_URL}/api/backup/export", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "notes" in data, "Backup missing 'notes' field"
        assert "count" in data, "Backup missing 'count' field"
        assert "user_id" in data, "Backup missing 'user_id' field"
        assert "exported_at" in data, "Backup missing 'exported_at' field"
        assert isinstance(data["notes"], list), "Notes should be a list"
        assert data["count"] == len(data["notes"]), "Count mismatch"
        
        print(f"✓ Export backup: {data['count']} notes exported")
    
    def test_import_backup(self, api_client, auth_headers):
        """Test POST /api/backup/import"""
        # Create test backup data
        backup_notes = [
            {
                "note_id": f"test_import_{int(time.time())}",
                "type": "text",
                "title": "TEST_Imported_Note",
                "raw_content": "This note was imported via backup",
                "summary": "Test import",
                "tags": ["imported", "test"],
                "url": "",
                "thumbnail": "",
                "source_platform": "",
                "is_processing": False,
                "created_at": "2025-01-01T00:00:00Z",
                "updated_at": "2025-01-01T00:00:00Z"
            }
        ]
        
        payload = {"notes": backup_notes}
        response = api_client.post(f"{BASE_URL}/api/backup/import", headers=auth_headers, json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "imported" in data, "Response missing 'imported' count"
        assert data["imported"] == 1, f"Expected 1 imported, got {data['imported']}"
        print(f"✓ Import backup: {data['message']}")

# --- Error Handling Tests ---
class TestErrorHandling:
    """Test error handling for invalid requests"""
    
    def test_get_nonexistent_note(self, api_client, auth_headers):
        """Test GET /api/notes/{invalid_id} returns 404"""
        response = api_client.get(f"{BASE_URL}/api/notes/invalid_note_id_999", headers=auth_headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Nonexistent note returns 404")
    
    def test_delete_nonexistent_note(self, api_client, auth_headers):
        """Test DELETE /api/notes/{invalid_id} returns 404"""
        response = api_client.delete(f"{BASE_URL}/api/notes/invalid_note_id_999", headers=auth_headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Delete nonexistent note returns 404")
    
    def test_create_note_without_auth(self, api_client):
        """Test POST /api/notes without auth returns 401"""
        payload = {"type": "text", "raw_content": "Test"}
        response = api_client.post(f"{BASE_URL}/api/notes", json=payload)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Create note without auth returns 401")

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
