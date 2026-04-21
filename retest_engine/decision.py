"""
Deterministic Decision Layer — Pre-checks BEFORE asking the LLM.

The idea is simple:
  - Some situations have OBVIOUS answers that don't need an LLM.
  - We check those first (fast, free, reliable).
  - Only if nothing is obvious → let the LLM decide.

Each check_* function returns either:
  - A verdict dict  →  {"status": "verified"/"not_fixed", "confidence": 0.9, "summary": "..."}
  - None            →  inconclusive, let LLM handle it

This keeps the LLM focused on HARD decisions, not obvious ones.
"""

from __future__ import annotations
from .logger import get_logger

log = get_logger(__name__)

# HTTP status codes that clearly mean "access denied" (vulnerability is fixed)
_ACCESS_DENIED_STATUSES = {401, 403, 404}

# Keywords in a response body that suggest access was denied
_ACCESS_DENIED_KEYWORDS = [
    "unauthorized", "forbidden", "access denied",
    "not allowed", "permission denied", "you don't have permission",
    "invalid token", "authentication required",
    "do not own", "you do not own", "not authorized",
    "access restricted", "insufficient privileges",
]

# Keywords that suggest real user data was exposed (as JSON field names)
_DATA_LEAK_KEYWORDS = [
    "ssn", "social security", "password", "credit card",
    "secret_key", "confidential", "email",
    "phone", "date_of_birth", "owner",  # owner = cross-user data leak in IDOR
]


def check_idor(http_status: int, response_body: str) -> dict | None:
    """
    Deterministic IDOR check based on HTTP status + response body.

    Args:
        http_status:   The HTTP status code from the IDOR probe request.
        response_body: The response body text (first 2000 chars is enough).

    Returns:
        A verdict dict if we're confident, None if inconclusive.
    """
    body_lower = response_body.lower()

    # Clear signal: server rejected the request → vulnerability is FIXED
    if http_status in _ACCESS_DENIED_STATUSES:
        log.info(f"[IDOR] Deterministic: HTTP {http_status} = access denied → FIXED")
        return {
            "status": "verified",
            "confidence": 0.95,
            "summary": (
                f"Server returned HTTP {http_status} when accessing another user's resource. "
                "Access control is enforced — vulnerability appears fixed."
            ),
        }

    # Clear signal: access denied mentioned in body
    if any(kw in body_lower for kw in _ACCESS_DENIED_KEYWORDS):
        matched = [kw for kw in _ACCESS_DENIED_KEYWORDS if kw in body_lower][0]
        log.info(f"[IDOR] Deterministic: body contains '{matched}' → likely FIXED")
        return {
            "status": "verified",
            "confidence": 0.80,
            "summary": (
                f"Response body contains '{matched}', suggesting access was denied. "
                "Vulnerability appears fixed."
            ),
        }

    # Clear signal: HTTP 200 + sensitive data in JSON field format → NOT FIXED
    # Use "fieldname": pattern (not bare keyword) to avoid false positives from
    # HTML form labels, hint text like "enter your password", or page boilerplate.
    if http_status == 200 and len(response_body) > 50:
        leaked = [
            kw for kw in _DATA_LEAK_KEYWORDS
            if f'"{kw}":' in body_lower or f"'{kw}':" in body_lower
        ]
        if leaked:
            log.info(f"[IDOR] Deterministic: HTTP 200 + leaked fields {leaked} → NOT FIXED")
            return {
                "status": "not_fixed",
                "confidence": 0.90,
                "summary": (
                    f"Server returned HTTP 200 with sensitive fields {leaked} in the response. "
                    "IDOR vulnerability is still exploitable."
                ),
            }

    # Inconclusive — let the LLM reason about it
    log.info(f"[IDOR] Deterministic: inconclusive (HTTP {http_status}, body len={len(response_body)})")
    return None


def check_xss(js_marker_value: any) -> dict | None:
    """
    Deterministic XSS check based on the JS marker window variable.

    Args:
        js_marker_value: Result of evaluating window['__xss_oknexus'] in the page.
                         Truthy (1, True, etc.) = payload executed.
                         Falsy (None, 0, False) = payload did NOT execute.

    Returns:
        A verdict dict if we're confident, None if inconclusive.
    """
    if js_marker_value:
        log.info("[XSS] Deterministic: JS marker executed → NOT FIXED")
        return {
            "status": "not_fixed",
            "confidence": 0.99,
            "summary": (
                "The XSS marker payload executed — window['__xss_oknexus'] is truthy. "
                "Stored XSS vulnerability is still present."
            ),
        }
    elif js_marker_value is not None:
        # Evaluated successfully but returned falsy (0, False, empty)
        log.info("[XSS] Deterministic: JS marker did not execute → FIXED")
        return {
            "status": "verified",
            "confidence": 0.95,
            "summary": (
                "The XSS marker payload did NOT execute — window['__xss_oknexus'] is falsy. "
                "Stored XSS vulnerability appears fixed."
            ),
        }

    # js_marker_value is None → evaluation failed (page navigated away, etc.)
    log.info("[XSS] Deterministic: JS eval returned None → inconclusive")
    return None


def check_open_redirect(initial_url: str, final_url: str) -> dict | None:
    """
    Deterministic Open Redirect check.
    Compares where the browser started vs where it ended up.

    Args:
        initial_url: The URL we navigated to (with the malicious redirect param).
        final_url:   The URL the browser actually landed on after the redirect.

    Returns:
        A verdict dict if we're confident, None if inconclusive.
    """
    # Extract domains
    try:
        from urllib.parse import urlparse
        initial_domain = urlparse(initial_url).netloc
        final_domain = urlparse(final_url).netloc
    except Exception:
        return None

    if not initial_domain or not final_domain:
        return None

    if final_domain != initial_domain:
        # Browser ended up on a different domain → redirect followed → NOT FIXED
        log.info(f"[REDIRECT] Deterministic: {initial_domain} → {final_domain} → NOT FIXED")
        return {
            "status": "not_fixed",
            "confidence": 0.95,
            "summary": (
                f"Browser was redirected from '{initial_domain}' to '{final_domain}'. "
                "Open redirect vulnerability is still present."
            ),
        }
    else:
        # Stayed on the same domain → redirect was blocked → FIXED
        log.info(f"[REDIRECT] Deterministic: stayed on {final_domain} → FIXED")
        return {
            "status": "verified",
            "confidence": 0.90,
            "summary": (
                f"Browser stayed on '{final_domain}' — the external redirect was blocked. "
                "Open redirect vulnerability appears fixed."
            ),
        }


def check_auth_bypass(http_status: int, response_body: str) -> dict | None:
    """
    Deterministic Auth Bypass check.
    
    Args:
        http_status:   HTTP status from accessing the protected resource.
        response_body: Response body text.

    Returns:
        A verdict dict if we're confident, None if inconclusive.
    """
    body_lower = response_body.lower()

    # Clearly blocked → FIXED
    if http_status in _ACCESS_DENIED_STATUSES:
        log.info(f"[AUTH_BYPASS] Deterministic: HTTP {http_status} → FIXED")
        return {
            "status": "verified",
            "confidence": 0.92,
            "summary": (
                f"Protected resource returned HTTP {http_status}. "
                "Authentication/authorization is enforced — bypass appears fixed."
            ),
        }

    # Got in AND accessing something clearly privileged → NOT FIXED
    privileged_signals = ["secret_key", "admin panel", "admin dashboard", "is_admin", "role\":\"admin"]
    protected_signals = ["restricted", "internal only", "confidential", "privileged"]
    deny_or_login_signals = ["login", "sign in", "unauthorized", "forbidden", "access denied"]

    if http_status == 200:
        strong_hits = sum(1 for kw in privileged_signals if kw in body_lower)
        weak_hits = sum(1 for kw in protected_signals if kw in body_lower)
        if (strong_hits >= 1 and weak_hits >= 1) or strong_hits >= 2:
            if any(kw in body_lower for kw in deny_or_login_signals):
                log.info("[AUTH_BYPASS] Deterministic: conflicting 200 response signals → inconclusive")
                return None
            log.info("[AUTH_BYPASS] Deterministic: HTTP 200 + privileged content signatures → NOT FIXED")
            return {
                "status": "not_fixed",
                "confidence": 0.90,
                "summary": (
                    "Successfully accessed a protected resource (HTTP 200 with privileged application content). "
                    "Auth bypass vulnerability is still present."
                ),
            }

    return None


def check_login_success(cookies: list[dict], visible_text: str) -> bool:
    """
    Simple heuristic to check if login succeeded.
    Used by the orchestrator to abort early if auth fails.

    Args:
        cookies:      List of cookies from the browser context.
        visible_text: The visible text on the page after login attempt.

    Returns:
        True if login appears successful, False if it failed.
    """
    # Common session cookie names
    session_cookie_names = {
        "session", "session_token", "sessionid", "auth_token",
        "access_token", "token", "jwt", "connect.sid",
    }
    has_session_cookie = any(
        c.get("name", "").lower() in session_cookie_names
        for c in cookies
    )
    if has_session_cookie:
        log.info("[AUTH] Session cookie detected → login likely successful")
        return True

    # Common failure indicators in visible text
    failure_keywords = [
        "invalid credentials", "wrong password", "login failed",
        "incorrect password", "authentication failed", "try again",
    ]
    text_lower = visible_text.lower()
    if any(kw in text_lower for kw in failure_keywords):
        log.info("[AUTH] Login failure keyword detected in page text")
        return False

    # Common success indicators
    success_keywords = [
        "logout", "sign out", "welcome", "dashboard", "profile",
        "my account", "log out",
    ]
    if any(kw in text_lower for kw in success_keywords):
        log.info("[AUTH] Success keyword detected in page text → login likely successful")
        return True

    # No clear signal — fail closed to avoid false confidence.
    log.info("[AUTH] Login status unclear — treating as not verified")
    return False
