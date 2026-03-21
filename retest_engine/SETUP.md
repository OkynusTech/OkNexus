# Retest Engine — Setup & Usage Guide

## Quick Start (3 minutes)

### 1. Prerequisites
- Python 3.10+
- Groq API key (free at https://console.groq.com)
- A target application to test (or use a test instance)

### 2. Install Dependencies
```bash
cd retest_engine
pip install -r requirements.txt
playwright install chromium
```

### 3. Configure Environment
```bash
cp .env.example .env
# Edit .env and add your GROQ_API_KEY
nano .env
```

Required:
```
GROQ_API_KEY=gsk_xxxxxxxxxx...
```

Optional:
```
GROQ_MODEL=llama3-70b-8192
HEADLESS=true                    # Set to false to see browser window
SCREENSHOT_DIR=/tmp/screenshots  # Where screenshots are saved
BROWSER_TIMEOUT_MS=30000
```

### 4. Start the Server
```bash
python -m flask --app retest_engine.server run --port 5555
```

Or directly:
```bash
python retest_engine/server.py
```

You should see:
```
2026-01-15 14:23:45 [INFO] server: Starting retest_engine server on http://localhost:5555
```

### 5. Submit a Retest Request
In another terminal:

```bash
curl -X POST http://localhost:5555/retest \
  -H "Content-Type: application/json" \
  -d '{
    "retest_id": "retest_001",
    "vulnerability_type": "IDOR",
    "target_url": "https://your-app.example.com",
    "steps_to_reproduce": "Login as user 42, navigate to /api/users/43/profile to access another users data",
    "credentials": {
      "username": "testuser@example.com",
      "password": "SecurePassword123"
    }
  }'
```

---

## API Reference

### Health Check
```
GET /health
```
Returns `200 OK` with service status.

### Get Service Info
```
GET /info
```
Returns endpoints and supported vulnerability types.

### Submit Retest
```
POST /retest
Content-Type: application/json

{
  "retest_id": "string (unique ID for this request)",
  "vulnerability_type": "IDOR | STORED_XSS",
  "target_url": "https://... (the vulnerable endpoint URL)",
  "steps_to_reproduce": "string (narrative description of how to trigger the vulnerability)",
  "credentials": {
    "username": "string",
    "password": "string"
  }
}
```

**Response (200 OK):**
```json
{
  "retest_id": "retest_001",
  "status": "not_fixed | verified | failed",
  "evidence": {
    "screenshots": [
      {"name": "login_success", "data": "iVBORw0KGgo...", "path": "/tmp/screenshots/..."}
    ],
    "logs": [
      {"level": "info", "msg": "Navigated to login page", "time": "2026-01-15T14:23:45"}
    ],
    "network_data": [
      {"url": "https://api.example.com/users/42/data", "method": "GET", "status": 200, ...}
    ],
    "details": {
      "confidence": 0.95,
      "probe_url": "https://api.example.com/users/43/data",
      "reason": "..."
    }
  }
}
```

**Response (400 Bad Request):**
```json
{
  "error": "Missing required fields: credentials"
}
```

**Response (500 Internal Error):**
```json
{
  "error": "Internal server error: ...",
  "trace": "Traceback..."
}
```

---

## Vulnerability Types

### IDOR (Insecure Direct Object Reference)
Verifies that a user cannot access resources belonging to another user.

**Steps to Reproduce Example:**
```
Login with user A (ID 42).
Navigate to GET /api/users/42/profile → returns user A's data.
Try to access GET /api/users/43/profile (user B).
If the response contains user B's data (200 + body > 64 bytes) → IDOR NOT fixed.
If access is denied (403/401) → IDOR is fixed.
```

**How It Works:**
1. Planner generates login actions from your steps.
2. Executor logs in with provided credentials.
3. Verifier extracts user IDs from the steps (or network traffic).
4. Verifier replays the request with a different user ID.
5. If 200 + data → `status: "not_fixed"`, else → `status: "verified"`.

### STORED_XSS (Stored Cross-Site Scripting)
Verifies that injected JavaScript payload no longer executes when the page is viewed.

**Steps to Reproduce Example:**
```
Login to the application.
Fill a comment field with <img src=x onerror="alert('xss')">
Submit the form.
Navigate to the page where the comment is displayed.
If the alert triggers → XSS NOT fixed.
If the alert does NOT trigger → XSS is fixed.
```

**How It Works:**
1. Planner generates actions from your steps.
2. Executor logs in and navigates to the injection point.
3. Verifier injects a non-disruptive marker: `<img src=x onerror="window['__xss_oknexus']=1">`
4. Executor submits the form and navigates to the reflection URL.
5. Verifier checks if `window['__xss_oknexus']` is truthy.
6. If true → `status: "not_fixed"`, else → `status: "verified"`.

---

## Return Status Values

| Status      | Meaning                                      |
|-------------|----------------------------------------------|
| `verified`  | ✅ Vulnerability is **fixed**.               |
| `not_fixed` | ⚠️  Vulnerability still **exploitable**.     |
| `failed`    | ❌ Execution **error** (check logs).         |

---

## Understanding the Evidence

The response includes full evidence for manual verification:

### Screenshots (base64-encoded)
Key milestones:
- `login_success` — After authentication
- `before_injection` — The target page before payload injection
- `after_injection` — After payload injection (if XSS)
- `reflection_page` — Where the payload is rendered (if XSS)
- `error_*` — If any step failed

Decode a screenshot:
```python
import base64
data = "iVBORw0KGgo..."  # from response
with open("screenshot.png", "wb") as f:
    f.write(base64.b64decode(data))
```

### Network Data
All captured HTTP requests/responses:
```json
{
  "url": "https://api.example.com/users/43/data",
  "method": "GET",
  "status": 200,
  "response_body": "{\n  \"id\": 43,\n  \"name\": \"...",
  "headers": {"content-type": "application/json", ...}
}
```

### Logs
Browser console messages and step-by-step execution logs for debugging:
```json
[
  {"level": "info", "msg": "Navigated to login page", "time": "2026-01-15T14:23:45"},
  {"level": "debug", "msg": "Filled '#username' = '***'", "time": "2026-01-15T14:23:46"},
  {"level": "error", "msg": "Action 'click' (Click login button) failed: Timeout", "time": "..."}
]
```

---

## Common Issues

### "ModuleNotFoundError: No module named 'playwright'"
```bash
pip install -r requirements.txt
playwright install chromium
```

### "GROQ_API_KEY is not set"
```bash
# Ensure .env exists and has GROQ_API_KEY
cat .env | grep GROQ_API_KEY
# If missing:
echo "GROQ_API_KEY=your_key_here" >> .env
```

### "Timeout waiting for selector"
The page structure may have changed. Review the steps_to_reproduce and test manually in the browser.

### "SSL certificate verify failed"
```bash
# Temporarily disable SSL verification (dev only):
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
# Or use http:// URLs if available
```

### XSS Not Detected But Vulnerability Exists
The verifier uses a non-disruptive payload (`<img src=x onerror>`). If your app has a WAF that blocks this specific pattern, try updating the payload in `config.py`:
```python
XSS_MARKER_PAYLOAD = '<img src=x onerror="window[\'__xss_custom\']=1">'
```

---

## Integration with Existing Backend

### Python (Flask)
```python
from retest_engine import run_retest

@app.route('/api/retest', methods=['POST'])
def trigger_retest():
    request_data = request.get_json()
    result = run_retest(request_data)
    return jsonify(result)
```

### Node.js / Express
```javascript
const { execSync } = require('child_process');

app.post('/api/retest', (req, res) => {
  const jsonInput = JSON.stringify(req.body);
  const result = execSync(`python -m retest_engine '${jsonInput}'`).toString();
  res.json(JSON.parse(result));
});
```

### via HTTP (any language)
```python
import requests

response = requests.post(
    "http://localhost:5555/retest",
    json={
        "retest_id": "r_001",
        "vulnerability_type": "IDOR",
        "target_url": "https://...",
        "steps_to_reproduce": "...",
        "credentials": {...}
    }
)
print(response.json())
```

---

## Logs & Debugging

All execution logs are printed to stdout with timestamps and severity levels.

To capture them:
```bash
python retest_engine/server.py > retest.log 2>&1 &
tail -f retest.log
```

To increase verbosity, edit `logger.py` and change:
```python
logger.setLevel(logging.INFO)  # was DEBUG
```

---

## Architecture Recap

```
Request (JSON)
    ↓
[Server] POST /retest
    ↓
[Orchestrator.run()]
    ├─ Phase 1: Planner → calls Groq LLM → action plan (JSON)
    ├─ Phase 2+3: Executor + Verifier
    │   ├─ Executor: Playwright browser automation
    │   ├─ IDOR/XSS verifier: exploit reproduction
    │   └─ Result: {"success": bool, "confidence": float, "evidence": {...}}
    ├─ Phase 4: Decision engine → status string
    └─ Phase 5: Return result (JSON)
    ↓
Response (JSON)
    ├─ status: "verified" | "not_fixed" | "failed"
    ├─ evidence: screenshots, logs, network_data
    └─ HTTP 200 or 500
```

---

## Example Usage (Production)

```bash
#!/bin/bash
# retest_workflow.sh — Automated retest pipeline

RETEST_URL="http://localhost:5555/retest"

submit_retest() {
  local id=$1
  local vuln_type=$2
  local target_url=$3
  local steps=$4
  local user=$5
  local pass=$6

  curl -s -X POST "$RETEST_URL" \
    -H "Content-Type: application/json" \
    -d "{
      \"retest_id\": \"$id\",
      \"vulnerability_type\": \"$vuln_type\",
      \"target_url\": \"$target_url\",
      \"steps_to_reproduce\": \"$steps\",
      \"credentials\": {
        \"username\": \"$user\",
        \"password\": \"$pass\"
      }
    }" | jq .
}

# Test IDOR on user endpoints
submit_retest \
  "r_2026_001" \
  "IDOR" \
  "https://api.example.com" \
  "Login as user 42, access /api/users/43/profile" \
  "alice" \
  "password123"

# Test Stored XSS on comments
submit_retest \
  "r_2026_002" \
  "STORED_XSS" \
  "https://app.example.com" \
  "Post a comment with JavaScript payload, refresh page" \
  "bob" \
  "password456"
```

---

## Performance Notes

- **Login**: 5–10 seconds
- **Navigation + Verifier**: 3–8 seconds
- **Screenshot capture**: ~1 second each
- **Total per retest**: 10–30 seconds (depending on app response times)

For batch operations, consider using a queue (Celery, RQ) and submitting requests asynchronously.

---

## Security Notes

- **Credentials**: Passed only to the executor (Playwright), never logged or stored.
- **Payloads**: The XSS payload is non-disruptive (no alert, no page redirects).
- **Screenshots**: Saved to disk (unencrypted). Use SCREENSHOT_DIR on secure storage.
- **Network data**: Captured responses may contain sensitive data. Implement scrubbing if needed.

---

## Support & Troubleshooting

If the service crashes, check:
1. `.env` file has `GROQ_API_KEY`
2. Playwright browsers are installed: `playwright install chromium`
3. Port 5555 is not in use: `lsof -i :5555`
4. Python version: `python --version` (3.10+)
5. Full traceback in stdout/logs

---

**Version**: 1.0
**Last Updated**: January 2026
