# Deployment Guide

---

## Vercel — Next.js Frontend

### 1. Import Project
1. Log in to [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New → Project** and import your GitHub repo.
3. Framework preset will auto-detect as **Next.js** — leave all build settings as default.

### 2. Environment Variables
Add these in Vercel **Settings → Environment Variables**:

| Key | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | From Google Cloud Console → OAuth 2.0 Client |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console → OAuth 2.0 Client |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Your Vercel production URL (e.g. `https://oknexus.vercel.app`) |
| `GROQ_API_KEY` | From [console.groq.com](https://console.groq.com) |
| `GEMINI_API_KEY` | From [aistudio.google.com](https://aistudio.google.com) — used by Template Wizard and Cover Graphic |
| `NEXT_PUBLIC_AI_ENABLED` | `true` |

> **Note on `NEXTAUTH_URL`**: After first deploy, Vercel assigns your URL. Update this env var and also add the domain to Google Cloud Console → Authorized Redirect URIs: `https://your-domain.vercel.app/api/auth/callback/google`

### 3. Deploy
Click **Deploy**. Once complete, update Google OAuth settings:
1. [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → your OAuth Client
2. Add to **Authorized JavaScript origins**: `https://your-domain.vercel.app`
3. Add to **Authorized redirect URIs**: `https://your-domain.vercel.app/api/auth/callback/google`

---

## Railway — Python Retest Engine

The engine is deployed as a Docker container on Railway (separate from the Next.js app).

### 1. Create a New Railway Service
1. In your [Railway project](https://railway.app), click **New Service → GitHub Repo**.
2. Select the same repo.
3. In **Settings → Build**, set **Dockerfile Path** to `Dockerfile.retest`.

### 2. Environment Variables (Railway)
Add these in Railway's Variables tab:

| Key | Value |
|---|---|
| `GROQ_API_KEY` | Your Groq API key |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` |
| `HEADLESS` | `true` |
| `PORT` | Set automatically by Railway |

### 3. Connect Vercel → Railway
In your Vercel project, add:

| Key | Value |
|---|---|
| `RETEST_ENGINE_URL` | Your Railway engine URL (e.g. `https://oknexus-engine.up.railway.app`) |

If not set, the Next.js app falls back to `http://127.0.0.1:5555` (local dev).

---

## Local Development

```bash
# Install all dependencies
npm install
pip install -r retest_engine/requirements.txt
python -m playwright install chromium

# Start everything (Next.js + Python engine)
npm run dev:all
```

Open [http://localhost:3000](http://localhost:3000).

See [retest-engine.md](./retest-engine.md) for engine-specific setup details.
