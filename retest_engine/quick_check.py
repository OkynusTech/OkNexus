"""
Quick Check Pre-Flight Module.

For simple URL-based vulnerabilities, we do NOT need a full browser session
or an LLM call to determine the verdict. We can make a direct HTTP request
and run the deterministic decision layer immediately.

Supported vulnerability types:
  - IDOR         : GET the resource URL, check HTTP status + body
  - OPEN_REDIRECT: GET the redirect URL, compare initial vs final domain
  - AUTH_BYPASS  : GET the protected resource, check HTTP status + body
  - REFLECTED_XSS: GET the URL with payload, check if payload is in response

NOT supported (require browser + interaction):
  - STORED_XSS   : needs browser JS execution to check marker
  - SQLI         : needs complex form interaction
  - CSRF         : needs full multi-step form flow

The quick_check() entry point returns:
  - A verdict dict if conclusive (caller should terminate immediately)
  - None           if inconclusive (caller falls through to full agent loop)

This allows IDOR/Redirect tests to return verdicts in <1 second with zero
LLM tokens consumed.
"""

from __future__ import annotations

import urllib.parse
from typing import Any

import requests

from .decision import check_idor, check_open_redirect, check_auth_bypass
from .logger import get_logger

log = get_logger(__name__)

# Timeout for direct HTTP requests (seconds)
_HTTP_TIMEOUT_S = 15

# Vuln types that can be checked before launching the browser
# NOTE: REFLECTED_XSS is intentionally excluded — checking raw HTTP body is unreliable.
# XSS exploitability requires JS execution which needs a real Playwright browser.
_QUICK_CHECK_SUPPORTED = {"IDOR", "OPEN_REDIRECT", "AUTH_BYPASS"}

# A basic browser-like User-Agent so servers don't block us outright
_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def quick_check(
    vuln_type: str,
    target_url: str,
    credentials: dict[str, Any],
    steps_to_reproduce: str = "",
) -> dict | None:
    """
    Attempt a verdict with a direct HTTP request — no browser, no LLM.

    Args:
        vuln_type:           e.g. "IDOR", "OPEN_REDIRECT"
        target_url:          The primary URL to probe.
        credentials:         May contain a session cookie or bearer token to send.
        steps_to_reproduce:  Used to extract a probe URL if different from target.

    Returns:
        Verdict dict  →  {status, confidence, summary, source: "quick_check"}
        None          →  inconclusive, fall through to full agentic loop
    """
    if vuln_type not in _QUICK_CHECK_SUPPORTED:
        log.debug(f"[quick_check] {vuln_type} not supported for quick check — skipping")
        return None

    log.info(f"[quick_check] Running pre-flight check for {vuln_type} on {target_url}")

    # Build request session with optional auth headers/cookies
    session = _build_session(credentials)

    try:
        if vuln_type == "IDOR":
            result = _check_idor(session, target_url)
        elif vuln_type == "OPEN_REDIRECT":
            result = _check_redirect(session, target_url)
        elif vuln_type == "AUTH_BYPASS":
            result = _check_auth_bypass(session, target_url)
        else:
            result = None
    except requests.exceptions.ConnectionError:
        log.warning(f"[quick_check] Could not connect to {target_url} — skipping quick check")
        return None
    except requests.exceptions.Timeout:
        log.warning(f"[quick_check] Request to {target_url} timed out — skipping quick check")
        return None
    except Exception as exc:
        log.warning(f"[quick_check] Unexpected error: {exc} — skipping quick check")
        return None

    if result:
        result["source"] = "quick_check"
        log.info(
            f"[quick_check] Pre-flight verdict: {result['status']} "
            f"(confidence={result['confidence']:.2f})"
        )

    return result


# ---------------------------------------------------------------------------
# Per-vulnerability check implementations
# ---------------------------------------------------------------------------

def _check_idor(session: requests.Session, url: str) -> dict | None:
    """
    GET the URL and run the IDOR decision layer on the response.
    Works best when target_url points directly to the resource endpoint.
    """
    resp = session.get(url, timeout=_HTTP_TIMEOUT_S, allow_redirects=True)
    log.debug(f"[quick_check/idor] GET {url} → HTTP {resp.status_code}, body_len={len(resp.text)}")
    return check_idor(resp.status_code, resp.text[:3000])


def _check_redirect(session: requests.Session, url: str) -> dict | None:
    """
    GET the redirect URL WITHOUT following it, then inspect the Location header.
    This avoids ConnectionError from unreachable external domains (like evil.example.com)
    while still accurately detecting whether the server is issuing a dangerous redirect.
    """
    try:
        resp = session.get(
            url,
            timeout=_HTTP_TIMEOUT_S,
            allow_redirects=False,   # ← key fix: don't follow the redirect
        )
    except Exception as exc:
        log.warning(f"[quick_check/redirect] Request failed: {exc}")
        return None

    log.debug(
        f"[quick_check/redirect] GET {url} → HTTP {resp.status_code}, "
        f"Location: {resp.headers.get('Location', '(none)')}"
    )

    # If the server issues a redirect (3xx), read the Location header directly
    if resp.is_redirect or resp.status_code in (301, 302, 303, 307, 308):
        location = resp.headers.get("Location", "")
        if location:
            return check_open_redirect(url, location)
        # Redirect with no Location header — inconclusive
        return None

    # No redirect issued — server kept the user on the same origin → FIXED
    if resp.status_code == 200:
        return {
            "status": "verified",
            "confidence": 0.85,
            "summary": (
                "The server did not issue a redirect response (HTTP 200 returned). "
                "Open redirect vulnerability appears fixed."
            ),
        }

    return None  # inconclusive for other status codes



def _check_auth_bypass(session: requests.Session, url: str) -> dict | None:
    """
    GET the protected resource and check if access was granted or denied.
    """
    resp = session.get(url, timeout=_HTTP_TIMEOUT_S, allow_redirects=True)
    log.debug(
        f"[quick_check/auth_bypass] GET {url} → HTTP {resp.status_code}, "
        f"body_len={len(resp.text)}"
    )
    return check_auth_bypass(resp.status_code, resp.text[:3000])


def _check_reflected_xss(session: requests.Session, url: str) -> dict | None:
    """
    GET the URL (which should already contain the XSS payload in the query string)
    and check if the raw payload is reflected back in the HTML response body.

    Note: This only detects reflection — NOT execution. Execution requires a browser.
    A reflected payload that is HTML-encoded is NOT exploitable.
    """
    from .config import XSS_MARKER_PAYLOAD

    # If the URL doesn't already contain the marker, try to inject it
    probe_url = url
    if "__xss_oknexus" not in url:
        separator = "&" if "?" in url else "?"
        encoded = urllib.parse.quote(XSS_MARKER_PAYLOAD, safe="")
        probe_url = f"{url}{separator}q={encoded}&input={encoded}"

    resp = session.get(probe_url, timeout=_HTTP_TIMEOUT_S, allow_redirects=True)
    body = resp.text
    log.debug(
        f"[quick_check/rxss] GET {probe_url} → HTTP {resp.status_code}, "
        f"body_len={len(body)}"
    )

    # Check if the RAW (unencoded) payload appears verbatim in the HTML
    if XSS_MARKER_PAYLOAD in body:
        return {
            "status": "not_fixed",
            "confidence": 0.85,
            "summary": (
                "The XSS payload was reflected UNENCODED in the server response. "
                "Reflected XSS vulnerability is likely still present "
                "(browser execution not confirmed — use full agent to verify JS execution)."
            ),
        }

    # Payload was either not reflected, or was HTML-encoded (safe)
    if resp.status_code == 200 and len(body) > 100:
        encoded_marker = "__xss_oknexus"
        if encoded_marker not in body:
            return {
                "status": "verified",
                "confidence": 0.70,
                "summary": (
                    "The XSS payload was NOT reflected in the server response. "
                    "Reflected XSS vulnerability appears fixed."
                ),
            }

    return None  # inconclusive — let agent handle it


# ---------------------------------------------------------------------------
# Session builder
# ---------------------------------------------------------------------------

def _build_session(credentials: dict[str, Any]) -> requests.Session:
    """
    Build a requests.Session pre-loaded with auth credentials.
    Supports: bearer token, raw cookie string, or no auth.
    Note: Form login credentials are NOT usable here (need browser interaction).
    """
    session = requests.Session()
    session.headers.update({"User-Agent": _USER_AGENT})

    auth_type = credentials.get("auth_type", "form")

    if auth_type == "bearer_token":
        token = credentials.get("token", "")
        if token:
            session.headers["Authorization"] = f"Bearer {token}"
            log.debug("[quick_check] Using bearer token auth")

    elif auth_type == "cookie":
        raw_cookies = credentials.get("cookies", "")
        if raw_cookies:
            # Parse "name=value; name2=value2" format
            for pair in raw_cookies.split(";"):
                pair = pair.strip()
                if "=" in pair:
                    name, _, value = pair.partition("=")
                    session.cookies.set(name.strip(), value.strip())
            log.debug("[quick_check] Using cookie auth")

    else:
        # form login — cannot do server-side, skip auth headers
        log.debug("[quick_check] Form login detected — quick check will run unauthenticated")

    return session
