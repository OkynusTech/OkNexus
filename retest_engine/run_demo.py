# -*- coding: utf-8 -*-
#!/usr/bin/env python3
"""
End-to-End Demo: OkNexus Retest Engine
======================================
Starts both servers, runs IDOR + XSS retests, prints a full report.

Usage:
    cd OkNexus
    python retest_engine/run_demo.py

Requirements:
    pip install -r retest_engine/requirements.txt
    playwright install chromium
    GROQ_API_KEY must be set in retest_engine/.env  (or env var)

What this script does:
    1. Starts target_app.py  on http://localhost:8080  (vulnerable app)
    2. Starts server.py      on http://localhost:5555  (retest engine API)
    3. Waits for both to be ready
    4. POSTs retest request #1  — IDOR test (bob reads alice's profile)
    5. POSTs retest request #2  — STORED_XSS test (inject payload, confirm execution)
    6. Prints a reporter-style report with full evidence summary
    7. Shuts everything down
"""

import io
import json
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

# Force UTF-8 output on Windows (avoids cp1252 UnicodeEncodeError)
if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "buffer"):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

try:
    import requests
except ImportError:
    sys.exit("ERROR: pip install requests")

# ── Config ─────────────────────────────────────────────────────────────────────

REPO_ROOT    = Path(__file__).parent.parent          # OkNexus/
ENGINE_DIR   = Path(__file__).parent                 # OkNexus/retest_engine/
TARGET_URL   = "http://localhost:8080"
ENGINE_URL   = "http://localhost:5555"
STARTUP_WAIT = 30   # seconds to wait for servers
RETEST_TIMEOUT = 120

# ── Colour helpers ─────────────────────────────────────────────────────────────

RESET  = "\033[0m"
BOLD   = "\033[1m"
RED    = "\033[91m"
GREEN  = "\033[92m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
GREY   = "\033[90m"

def c(colour: str, text: str) -> str:
    return f"{colour}{text}{RESET}"

def banner(title: str) -> None:
    w = 70
    print()
    print(c(CYAN, "═" * w))
    print(c(CYAN + BOLD, f"  {title}"))
    print(c(CYAN, "═" * w))

def section(title: str) -> None:
    print()
    print(c(BOLD, f"── {title} {'─' * max(0, 65 - len(title))}"))

def ok(msg: str)   -> None: print(c(GREEN,  f"  ✓  {msg}"))
def err(msg: str)  -> None: print(c(RED,    f"  ✗  {msg}"))
def info(msg: str) -> None: print(c(GREY,   f"     {msg}"))
def warn(msg: str) -> None: print(c(YELLOW, f"  ⚠  {msg}"))

# ── Server lifecycle ───────────────────────────────────────────────────────────

def _wait_for(url: str, name: str, timeout: int = STARTUP_WAIT) -> bool:
    """Poll url/health until 200 or timeout."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            r = requests.get(f"{url}/health", timeout=2)
            if r.status_code == 200:
                return True
        except Exception:
            pass
        time.sleep(1)
    return False


def start_servers() -> tuple[subprocess.Popen, subprocess.Popen]:
    section("Starting Servers")

    env = {**os.environ, "PYTHONUNBUFFERED": "1", "PYTHONIOENCODING": "utf-8"}

    # ── Vulnerable target app ──────────────────────────────────────────────────
    target_proc = subprocess.Popen(
        [sys.executable, str(ENGINE_DIR / "target_app.py")],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        env=env,
        cwd=str(REPO_ROOT),
    )
    info(f"Launched target_app.py  PID={target_proc.pid}")

    # ── Retest engine server ───────────────────────────────────────────────────
    server_proc = subprocess.Popen(
        [sys.executable, "-m", "retest_engine.server"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        env=env,
        cwd=str(REPO_ROOT),
    )
    info(f"Launched server.py      PID={server_proc.pid}")

    # ── Wait for readiness ─────────────────────────────────────────────────────
    print()
    info("Waiting for target app  (http://localhost:8080)...")
    if _wait_for(TARGET_URL, "target_app"):
        ok("Target app is up")
    else:
        err("Target app failed to start — check for port conflicts")
        target_proc.kill()
        server_proc.kill()
        sys.exit(1)

    info("Waiting for retest engine  (http://localhost:5555)...")
    if _wait_for(ENGINE_URL, "retest_engine"):
        ok("Retest engine is up")
    else:
        err("Retest engine failed to start — is GROQ_API_KEY set?")
        target_proc.kill()
        server_proc.kill()
        sys.exit(1)

    return target_proc, server_proc


def stop_servers(procs: list[subprocess.Popen]) -> None:
    section("Shutting Down")
    for p in procs:
        try:
            p.terminate()
            p.wait(timeout=5)
            ok(f"PID {p.pid} stopped")
        except Exception as e:
            warn(f"PID {p.pid}: {e}")


# ── Retest helpers ─────────────────────────────────────────────────────────────

def run_retest(payload: dict) -> dict:
    r = requests.post(f"{ENGINE_URL}/retest", json=payload, timeout=RETEST_TIMEOUT)
    r.raise_for_status()
    return r.json()


# ── Report formatting ─────────────────────────────────────────────────────────

STATUS_ICON = {
    "not_fixed": c(RED,    "NOT FIXED  ⚠"),
    "verified":  c(GREEN,  "FIXED / VERIFIED  ✓"),
    "failed":    c(YELLOW, "TEST FAILED  ✗"),
}

def _fmt_status(status: str) -> str:
    return STATUS_ICON.get(status, c(GREY, status.upper()))


def print_result(label: str, vuln_type: str, result: dict) -> None:
    status  = result.get("status", "unknown")
    ev      = result.get("evidence", {})
    details = ev.get("details", {})

    section(f"Result: {label}")
    print(f"  Status    : {_fmt_status(status)}")
    print(f"  Vuln Type : {vuln_type}")

    if result.get("error"):
        print(f"  Error     : {c(RED, result['error'])}")

    if details.get("confidence") is not None:
        print(f"  Confidence: {details['confidence']:.0%}")

    if details.get("reason"):
        print(f"  Reason    : {details['reason']}")

    if details.get("probe_url"):
        print(f"  Probe URL : {details['probe_url']}")

    if details.get("http_status"):
        print(f"  HTTP Code : {details['http_status']}")

    shots  = ev.get("screenshots", [])
    logs   = ev.get("logs", [])
    net    = ev.get("network_data", [])

    print()
    print("  Evidence Collected:")
    print(f"    • Screenshots   : {len(shots)}")
    print(f"    • Log entries   : {len(logs)}")
    print(f"    • Network reqs  : {len(net)}")

    # Show last few log lines
    if logs:
        print()
        print("  Execution Log (last 8 entries):")
        for entry in logs[-8:]:
            lvl = entry.get("level", "info").upper()
            msg = entry.get("msg", "")
            col = GREY if lvl == "DEBUG" else (RED if lvl == "ERROR" else RESET)
            print(f"    {c(col, f'[{lvl:5}]')} {msg}")

    # Show captured network requests
    if net:
        print()
        print("  Network Requests:")
        for req in net[:5]:
            status_code = req.get("status", "?")
            col = RED if status_code == 200 and "idor" in label.lower() else GREY
            print(f"    {c(col, str(status_code))}  {req.get('method','?')} {req.get('url','?')}")
            body = req.get("response_body", "")
            if body:
                # Truncate long bodies
                preview = body[:120] + ("…" if len(body) > 120 else "")
                print(f"         └─ {c(GREY, preview)}")


def print_final_summary(results: list[dict]) -> None:
    banner("FINAL REPORT — OkNexus Retest Engine Demo")
    print(f"  Generated : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Target    : {TARGET_URL}")
    print(f"  Engine    : {ENGINE_URL}")
    print()

    rows = []
    for label, vuln_type, result in results:
        status = result.get("status", "unknown")
        rows.append((label, vuln_type, status))

    # Table
    col1, col2, col3 = 30, 15, 20
    header = f"  {'Retest':<{col1}} {'Type':<{col2}} {'Verdict':<{col3}}"
    print(c(BOLD, header))
    print("  " + "─" * (col1 + col2 + col3 + 4))
    for label, vuln_type, status in rows:
        icon = {"not_fixed": "⚠  NOT FIXED", "verified": "✓  FIXED", "failed": "✗  FAILED"}.get(status, status)
        col  = RED if status == "not_fixed" else (GREEN if status == "verified" else YELLOW)
        print(f"  {label:<{col1}} {vuln_type:<{col2}} {c(col, icon)}")

    print()
    not_fixed = sum(1 for _, _, s in rows if s == "not_fixed")
    verified  = sum(1 for _, _, s in rows if s == "verified")
    failed    = sum(1 for _, _, s in rows if s == "failed")
    print(f"  Summary: {c(RED, str(not_fixed))} not fixed  |  {c(GREEN, str(verified))} fixed  |  {c(YELLOW, str(failed))} failed")


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    banner("OkNexus Retest Engine — End-to-End Demo")
    print("  This demo spins up a vulnerable test app and runs automated")
    print("  retests to verify whether IDOR and Stored XSS are still present.")
    print()
    print(c(YELLOW, "  ⚠  The target app is INTENTIONALLY VULNERABLE."))
    print(c(YELLOW, "     Run this only on localhost for testing purposes."))

    target_proc, server_proc = start_servers()
    results = []

    try:
        # ── Reset target app state ─────────────────────────────────────────────
        requests.post(f"{TARGET_URL}/reset", timeout=5)
        info("Target app state reset")

        # ── TEST 1: IDOR ───────────────────────────────────────────────────────
        section("Test 1 of 2 — IDOR (Insecure Direct Object Reference)")
        print()
        info("Scenario: Bob (user id=2) should only see his own profile.")
        info("Vulnerability: GET /api/users/1 returns Alice's data (incl. SSN)")
        info("Expected engine result: NOT FIXED (vulnerability still present)")
        print()

        idor_payload = {
            "retest_id": "demo_idor_001",
            "vulnerability_type": "IDOR",
            "target_url": TARGET_URL,
            "steps_to_reproduce": (
                "Login as bob with password password123. "
                "Navigate to GET /api/users/2 to confirm you see your own profile (id=2). "
                "Then access GET /api/users/1 — if you receive user id=1 (Alice's) data with status 200, "
                "the IDOR is NOT fixed."
            ),
            "credentials": {
                "username": "bob",
                "password": "password123",
            },
        }

        info("Submitting IDOR retest to engine...")
        t0 = time.time()
        idor_result = run_retest(idor_payload)
        elapsed = time.time() - t0
        ok(f"IDOR retest completed in {elapsed:.1f}s")
        print_result("IDOR — Bob reads Alice's profile", "IDOR", idor_result)
        results.append(("IDOR — Bob reads Alice's profile", "IDOR", idor_result))

        # ── TEST 2: STORED XSS ────────────────────────────────────────────────
        section("Test 2 of 2 — Stored XSS (Cross-Site Scripting)")
        print()
        info("Scenario: Bob submits a comment with a JavaScript payload.")
        info("Vulnerability: Comment is stored and reflected without sanitization.")
        info("Expected engine result: NOT FIXED (payload executes on page load)")
        print()

        xss_payload = {
            "retest_id": "demo_xss_001",
            "vulnerability_type": "STORED_XSS",
            "target_url": TARGET_URL,
            "steps_to_reproduce": (
                "Login as bob with password password123. "
                "Navigate to the homepage at /. "
                "Fill the comment textarea with the XSS payload and click the Post Comment button. "
                "After posting, navigate back to / and check if the payload executed."
            ),
            "credentials": {
                "username": "bob",
                "password": "password123",
            },
        }

        info("Submitting STORED_XSS retest to engine...")
        t0 = time.time()
        xss_result = run_retest(xss_payload)
        elapsed = time.time() - t0
        ok(f"XSS retest completed in {elapsed:.1f}s")
        print_result("Stored XSS — Comment injection", "STORED_XSS", xss_result)
        results.append(("Stored XSS — Comment injection", "STORED_XSS", xss_result))

    except KeyboardInterrupt:
        warn("Interrupted by user")
    except Exception as e:
        err(f"Unexpected error: {e}")
        import traceback; traceback.print_exc()
    finally:
        stop_servers([target_proc, server_proc])

    if results:
        print_final_summary(results)

    print()
    print(c(GREY, "  Full JSON responses saved to stdout above."))
    print(c(GREY, "  Screenshots (base64 PNG) are embedded in the evidence.logs."))
    print()


if __name__ == "__main__":
    main()
