# Retest Engine — Setup & API Reference

The Retest Engine is a standalone Python service that autonomously verifies whether a reported vulnerability has been fixed, using a headless browser and an AI observe-reason-act loop.

---

## Quick Start

### 1. Install Dependencies
```bash
# From the project root:
pip install -r retest_engine/requirements.txt
python -m playwright install chromium
```

### 2. Configure Environment
Add the following to your root `.env.local` (the engine loads it automatically):
```env
GROQ_API_KEY=gsk_xxxxxxxxxx
GROQ_MODEL=llama-3.3-70b-versatile   # optional, this is the default
HEADLESS=true                          # set to false to watch the browser
SCREENSHOT_DIR=.retest_screenshots     # relative to project root
BROWSER_TIMEOUT_MS=30000
```

### 3. Start the Engine
```bash
# Recommended — starts both Next.js and the engine together:
npm run dev:all

# Or start the engine alone:
py -m flask --app retest_engine.server run --port 5555
```

---

## Supported Vulnerability Types

| Type | Description |
|---|---|
| `IDOR` | Insecure Direct Object Reference — unauthorized access to another user's data |
| `STORED_XSS` | Stored Cross-Site Scripting — injected JS payload persists and executes |
| `REFLECTED_XSS` | Reflected XSS via URL parameter |
| `AUTH_BYPASS` | Authentication bypass on protected endpoints |
| `CSRF` | Cross-Site Request Forgery — state-changing request without token |
| `OPEN_REDIRECT` | Open redirect via manipulated `next=` / `redirect=` parameter |
| `SQLI` | SQL Injection visible via error messages or response content |

---

## Agent Action Types

The LLM controls the browser by issuing these structured JSON actions each turn:

| Action | Purpose |
|---|---|
| `navigate` | Go to a URL |
| `fill` | Fill a form field by CSS selector |
| `click` | Click an element |
| `api_request` | Direct HTTP request (GET / POST / etc.) from within browser context |
| `evaluate_js` | Run a JavaScript expression and return the result |
| `extract_form_tokens` | Extract all `<input type="hidden">` fields from a form (CSRF testing) |
| `check_redirect` | Navigate and capture the final redirect destination URL |
| `wait` | Wait N milliseconds |
| `verdict` | Issue final verdict: `not_fixed` / `fixed` / `inconclusive` |

---

## Adaptive Turn Budgets

The engine adapts its maximum turns based on vulnerability complexity:

| Vulnerability | Max Turns |
|---|---|
| Open Redirect | 8 |
| CSRF, Reflected XSS | 10 |
| IDOR, Auth Bypass | 12 |
| Stored XSS, SQLi | 15 |

---

## API Reference

### Health Check
```
GET http://localhost:5555/health
```

### SSE Streaming Retest (used by the Next.js UI)
```
POST http://localhost:5555/retest/stream
Content-Type: application/json

{
  "retest_id": "r_001",
  "vulnerability_type": "IDOR",
  "target_url": "https://your-app.example.com",
  "steps_to_reproduce": "Login as bob, GET /api/users/2 to access alice's data",
  "credentials": {
    "auth_type": "form",
    "username": "bob",
    "password": "password123"
  }
}
```

**Authentication types (`auth_type`):**
- `form` — username + password posted to login form (default)
- `bearer_token` — provide `token` field instead
- `cookie` — provide `cookies` as a list of `{name, value}` objects

### SSE Event Stream

The engine emits these events in real time while running:

| Event | Payload |
|---|---|
| `turn_start` | `{turn, max_turns}` |
| `turn_action` | `{turn, action, reasoning}` |
| `turn_result` | `{turn, result}` |
| `verdict` | `{status, confidence, summary}` |
| `complete` | Full result JSON |
| `error` | `{message}` — always emitted on crash so the UI never hangs |

### Result Statuses

| Status | Meaning |
|---|---|
| `verified` | ✅ Vulnerability is **fixed** |
| `not_fixed` | ⚠️ Vulnerability is **still exploitable** |
| `failed` | ❌ Engine error — check logs |

---

## Module Reference

| File | Purpose |
|---|---|
| `server.py` | Flask app, SSE `/retest/stream` endpoint |
| `orchestrator.py` | Main agentic loop, action dispatch, verdict logic |
| `agent_brain.py` | LLM system prompt, conversation history, JSON parsing |
| `llm_client.py` | Groq API client with retry/backoff |
| `executor.py` | Playwright browser session and basic action runner |
| `page_state.py` | DOM snapshot extraction and state-to-text serializer |
| `auth.py` | Form login, Bearer token, and Cookie auth helpers |
| `action_schema.py` | Canonical list of valid actions with documentation |
| `decision.py` | Verdict-to-status mapping helpers |
| `config.py` | ENV var parsing |
| `event_stream.py` | Thread-safe SSE EventBus |

---

## Troubleshooting

| Error | Fix |
|---|---|
| `ModuleNotFoundError: playwright` | `pip install -r retest_engine/requirements.txt` then `python -m playwright install chromium` |
| `GROQ_API_KEY is not set` | Add `GROQ_API_KEY=...` to `.env.local` in project root and restart Flask |
| `Port 5555 already in use` | Kill the old process: `Get-Process python \| Stop-Process -Force` (Windows) |
| Playwright `Executable doesn't exist` | Run `python -m playwright install chromium` again |
| Stream ends without a result | Check Flask terminal for a Python traceback — the engine emits it over SSE |

---

## Security Notes

- Credentials are passed only to the Playwright executor — never logged.
- The XSS payload is non-disruptive: `<img src=x onerror="window['__xss_oknexus']=1">`.
- Screenshots may contain sensitive data — use a private `SCREENSHOT_DIR`.
