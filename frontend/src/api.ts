import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem('access_token');
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function registerEmail(email: string, password: string, name: string) {
  const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Registration failed');
  }
  const data = await res.json();
  await AsyncStorage.setItem('access_token', data.access_token);
  return data;
}

export async function loginEmail(email: string, password: string) {
  const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Login failed');
  }
  const data = await res.json();
  await AsyncStorage.setItem('access_token', data.access_token);
  return data;
}

export async function getMe() {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND_URL}/api/auth/me`, { headers });
  if (!res.ok) throw new Error('Not authenticated');
  return res.json();
}

export async function logout() {
  await AsyncStorage.removeItem('access_token');
}

export async function createNote(data: {
  type: string;
  url?: string;
  title?: string;
  raw_content?: string;
  image_base64?: string;
  audio_base64?: string;
}) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND_URL}/api/notes`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  return res.json();
}

export async function listNotes(tag?: string, page: number = 1) {
  const headers = await authHeaders();
  let url = `${BACKEND_URL}/api/notes?page=${page}`;
  if (tag) url += `&tag=${encodeURIComponent(tag)}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error('Failed to fetch notes');
  return res.json();
}

export async function getNote(noteId: string) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND_URL}/api/notes/${noteId}`, {
    headers,
  });
  if (!res.ok) throw new Error('Note not found');
  return res.json();
}

export async function deleteNote(noteId: string) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND_URL}/api/notes/${noteId}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) throw new Error('Failed to delete');
  return res.json();
}

export async function searchNotes(query: string) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND_URL}/api/notes/search`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}

export async function exportBackup() {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND_URL}/api/backup/export`, {
    headers,
  });
  if (!res.ok) throw new Error('Export failed');
  return res.json();
}

export async function importBackup(notes: any[]) {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND_URL}/api/backup/import`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ notes }),
  });
  if (!res.ok) throw new Error('Import failed');
  return res.json();
}
