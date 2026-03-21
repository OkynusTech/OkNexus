'use client';

import { useState, useEffect } from 'react';

interface Comment { author: string; text: string; }

export default function TestAppPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [loggedInAs, setLoggedInAs] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [idorResult, setIdorResult] = useState<any>(null);
  const [idorId, setIdorId] = useState('1');
  const [msg, setMsg] = useState('');

  const fetchComments = async () => {
    const res = await fetch('/api/testapp/comments');
    setComments(await res.json());
  };

  useEffect(() => { fetchComments(); }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    const res = await fetch('/api/testapp/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (res.ok) {
      setToken(data.token);
      setLoggedInAs(data.name);
      setMsg(`✅ Logged in! Token: ${data.token}`);
    } else {
      setMsg(`❌ Login failed: ${data.error}`);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setLoggedInAs(null);
    setIdorResult(null);
    setMsg('Logged out.');
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/testapp/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Session-Token': token } : {}) },
      body: JSON.stringify({ text: commentText }),
    });
    setCommentText('');
    fetchComments();
  };

  const handleIDOR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) { setMsg('❌ Login first!'); return; }
    const res = await fetch(`/api/testapp/users/${idorId}`, {
      headers: { 'X-Session-Token': token },
    });
    setIdorResult(await res.json());
  };

  const resetAll = async () => {
    await fetch('/api/testapp/reset', { method: 'POST' });
    setToken(null); setLoggedInAs(null); setIdorResult(null);
    setComments([]); setMsg('State reset.');
  };

  const s = (cls: string) => cls; // passthrough for readability

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 720, margin: '40px auto', padding: '0 20px' }}>
      {/* Banner */}
      <div style={{ background: '#fef08a', border: '2px solid #ca8a04', borderRadius: 8, padding: '10px 16px', marginBottom: 24 }}>
        <strong>⚠️ INTENTIONALLY VULNERABLE TEST Application</strong> — For OkNexus Retest Engine testing only. Do NOT use in production.
      </div>

      <h1 style={{ fontSize: 28, fontWeight: 700 }}>TestCorp Internal Portal</h1>
      {loggedInAs && <p style={{ color: '#16a34a', fontWeight: 600 }}>✅ Logged in as: {loggedInAs}</p>}
      {msg && <p style={{ background: '#f3f4f6', padding: 10, borderRadius: 6 }}>{msg}</p>}

      <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #e5e7eb' }}>
        <h2>{loggedInAs ? 'Switch Account' : 'Login'}</h2>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360 }}>
          <input value={username} onChange={e => setUsername(e.target.value)} placeholder="alice or bob" style={inputStyle} />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="password123" style={inputStyle} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" style={btnStyle('#4f46e5')}>Login</button>
            {token && <button type="button" onClick={handleLogout} style={btnStyle('#6b7280')}>Logout</button>}
          </div>
        </form>
      </div>

      {/* IDOR */}
      <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #e5e7eb' }}>
        <h2>🚨 Vulnerability 1: IDOR — <code>/api/testapp/users/:id</code></h2>
        <p style={{ color: '#6b7280', fontSize: 14 }}>Login as <b>bob</b>, then query user <b>1</b> (Alice) to see her SSN. No ownership check.</p>
        <form onSubmit={handleIDOR} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
          <label>User ID: <input type="number" min={1} max={3} value={idorId} onChange={e => setIdorId(e.target.value)} style={{ ...inputStyle, width: 80 }} /></label>
          <button type="submit" style={btnStyle('#dc2626')}>Fetch User</button>
        </form>
        {idorResult && (
          <pre style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: 12, marginTop: 8, fontSize: 13 }}>
            {JSON.stringify(idorResult, null, 2)}
          </pre>
        )}
      </div>

      {/* Stored XSS */}
      <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #e5e7eb' }}>
        <h2>🚨 Vulnerability 2: Stored XSS — <code>POST /api/testapp/comments</code></h2>
        <p style={{ color: '#6b7280', fontSize: 14 }}>Comments are stored and rendered as raw HTML (no sanitization). Try: <code>&lt;img src=x onerror="alert(1)"&gt;</code></p>
        <form onSubmit={handleComment} style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 480 }}>
          <textarea value={commentText} onChange={e => setCommentText(e.target.value)} rows={3} placeholder="Type your comment (try an XSS payload)..." style={{ ...inputStyle, resize: 'vertical' }} />
          <button type="submit" style={btnStyle('#4f46e5')}>Post Comment</button>
        </form>

        <div style={{ marginTop: 12 }}>
          {comments.length === 0 && <p><i>No comments yet.</i></p>}
          {comments.map((c, i) => (
            <div key={i} style={{ background: '#f3f4f6', padding: '8px 12px', borderRadius: 6, marginBottom: 6 }}>
              <b>{c.author}</b>:{' '}
              {/* Raw HTML — intentionally vulnerable to XSS */}
              <span dangerouslySetInnerHTML={{ __html: c.text }} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #e5e7eb' }}>
        <button onClick={resetAll} style={btnStyle('#6b7280')}>🔄 Reset All State</button>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14,
  width: '100%', boxSizing: 'border-box',
};

const btnStyle = (bg: string): React.CSSProperties => ({
  padding: '8px 20px', background: bg, color: '#fff', border: 'none',
  borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 600,
});
