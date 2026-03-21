import { NextRequest, NextResponse } from 'next/server';

// ── In-memory state (resets on cold start, same as Flask version) ─────────────
export const USERS: Record<number, { id: number; name: string; email: string; role: string; ssn: string }> = {
  1: { id: 1, name: 'Alice Johnson', email: 'alice@testcorp.com', role: 'admin', ssn: '123-45-6789' },
  2: { id: 2, name: 'Bob Smith', email: 'bob@testcorp.com', role: 'user', ssn: '987-65-4321' },
  3: { id: 3, name: 'Carol White', email: 'carol@testcorp.com', role: 'user', ssn: '555-12-3456' },
};

export const SESSIONS: Record<string, number> = {};
export const COMMENTS: { author: string; text: string }[] = [];

const CREDS: Record<string, [number, string]> = {
  alice: [1, 'password123'],
  bob: [2, 'password123'],
  carol: [3, 'password123'],
  'alice@testcorp.com': [1, 'password123'],
  'bob@testcorp.com': [2, 'password123'],
};

export function resolveUser(req: NextRequest): typeof USERS[number] | null {
  const token = req.headers.get('X-Session-Token') || req.cookies.get('session_token')?.value;
  if (!token) return null;
  const uid = SESSIONS[token];
  return uid ? USERS[uid] : null;
}

export function validateCreds(username: string, password: string) {
  const entry = CREDS[username.trim()];
  if (!entry || entry[1] !== password.trim()) return null;
  const [uid] = entry;
  const token = `tok_${uid}_${Date.now()}`;
  SESSIONS[token] = uid;
  return { token, uid, name: USERS[uid].name };
}

export function GET() {
  return NextResponse.json({ status: 'ok', users: Object.keys(USERS).length, comments: COMMENTS.length });
}
