"""
Central configuration — reads from environment variables.
Copy .env.example to .env and fill in values before running.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env.local from the root directory (works regardless of cwd)
_env_path = Path(__file__).parent.parent / ".env.local"
load_dotenv(_env_path)

# ── Groq ──────────────────────────────────────────────────────────────────────
GROQ_API_KEY: str = os.environ.get("GROQ_API_KEY", "")
GROQ_MODEL: str = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")

# ── Playwright ────────────────────────────────────────────────────────────────
HEADLESS: bool = os.environ.get("HEADLESS", "true").lower() == "true"
BROWSER_TIMEOUT_MS: int = int(os.environ.get("BROWSER_TIMEOUT_MS", "30000"))

# ── Evidence storage ──────────────────────────────────────────────────────────
SCREENSHOT_DIR: str = os.environ.get("SCREENSHOT_DIR", "/tmp/retest_screenshots")

# ── Agent Loop ───────────────────────────────────────────────────────────────
MAX_AGENT_TURNS: int = int(os.environ.get("MAX_AGENT_TURNS", "15"))

# ── XSS payload ──────────────────────────────────────────────────────────────
# Minimal payload — sets a detectable window flag, avoids noisy alert()
XSS_MARKER_PAYLOAD: str = "<img src=x onerror=\"window['__xss_oknexus']=1\">"
XSS_MARKER_EXPR: str = "window['__xss_oknexus']"
