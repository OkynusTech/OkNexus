"""
Recovery & Guardrails Module.

Problem being solved:
  The agent crashes hard when a CSS selector doesn't exist in the DOM,
  or when authentication silently fails and the agent keeps testing anyway.

What this module provides:

  1. smart_fill(page, selector, value, field_hint)
     Tries up to 4 fallback strategies to fill an input.
     Never raises — returns True/False so calling code can handle gracefully.

  2. smart_click(page, selector, text_hint)
     Tries up to 4 fallback strategies to click a button/link.
     Never raises — returns True/False.

  3. verify_login_success(page, context)
     Heuristic check: did the login actually work?
     Checks cookies + visible text for clear success/failure signals.
     Returns (bool, str): (success, reason).

  4. safe_navigate(page, url)
     Navigates with a timeout guard. Returns (bool, str).
     Never crashes — catches all playwright exceptions.

  5. safe_evaluate(page, js_expression, default)
     Runs arbitrary JS on the page. On any error returns `default`.
     Used safely to check XSS markers without crashing.

Usage in orchestrator / executor:
  from .recovery import smart_fill, smart_click, verify_login_success, safe_navigate, safe_evaluate
"""

from __future__ import annotations

import asyncio
from typing import Any

from playwright.async_api import Page, BrowserContext, TimeoutError as PlaywrightTimeoutError

from .logger import get_logger

log = get_logger(__name__)

# Default timeout for individual element waits (ms)
_ELEMENT_TIMEOUT_MS = 5_000

# Common session cookie names — presence of any of these = logged in
_SESSION_COOKIE_NAMES = {
    "session", "session_token", "sessionid", "auth_token",
    "access_token", "token", "jwt", "connect.sid",
    "ok_portal_user_id", "next-auth.session-token",
}

# Text patterns that almost certainly mean the login succeeded
_AUTH_SUCCESS_KEYWORDS = [
    "logout", "sign out", "log out", "welcome",
    "dashboard", "profile", "my account", "signed in",
]

# Text patterns that almost certainly mean the login failed
_AUTH_FAILURE_KEYWORDS = [
    "invalid credentials", "wrong password", "login failed",
    "incorrect password", "authentication failed", "try again",
    "invalid username", "account not found", "access denied",
]


# ---------------------------------------------------------------------------
# 1. smart_fill
# ---------------------------------------------------------------------------

async def smart_fill(
    page: Page,
    selector: str,
    value: str,
    field_hint: str = "",
) -> bool:
    """
    Fill an input field using up to 4 progressive fallback strategies.

    Args:
        page:       Playwright page instance.
        selector:   The primary CSS selector to try first.
        value:      The text value to type into the field.
        field_hint: A human-readable hint about the field name (e.g. "username")
                    used to build fallback selectors.

    Returns:
        True  — if the fill succeeded on any strategy.
        False — if all 4 strategies failed (caller should log and continue).
    """
    strategies: list[str] = [selector]

    # Build fallback selectors from field_hint
    if field_hint:
        hint = field_hint.lower().strip()
        strategies += [
            f"[name='{hint}']",
            f"[id='{hint}']",
            f"[placeholder*='{hint}']",
            f"input[type='text']",  # last resort: first text field
        ]
    else:
        strategies += [
            "input[type='text']",
            "input[type='email']",
            "input",
        ]

    # Deduplicate while preserving order
    seen: set[str] = set()
    unique_strategies = [s for s in strategies if not (s in seen or seen.add(s))]   # type: ignore[func-returns-value]

    for i, strat in enumerate(unique_strategies, start=1):
        try:
            await page.wait_for_selector(strat, timeout=_ELEMENT_TIMEOUT_MS)
            await page.fill(strat, value)
            if i > 1:
                log.info(f"[recovery] smart_fill: strategy {i} worked → '{strat}'")
            return True
        except Exception as exc:
            log.debug(f"[recovery] smart_fill: strategy {i} ('{strat}') failed: {exc}")
            continue

    log.warning(
        f"[recovery] smart_fill: ALL strategies failed for field '{field_hint or selector}'"
    )
    return False


# ---------------------------------------------------------------------------
# 2. smart_click
# ---------------------------------------------------------------------------

async def smart_click(
    page: Page,
    selector: str,
    text_hint: str = "",
) -> bool:
    """
    Click a button or link using up to 4 progressive fallback strategies.

    Args:
        page:       Playwright page instance.
        selector:   The primary CSS selector to try first.
        text_hint:  Visible text of the button/link (used for fallback searches).

    Returns:
        True  — if the click succeeded on any strategy.
        False — if all strategies failed.
    """
    strategies: list[str] = [selector]

    if text_hint:
        # Playwright has a built-in text selector and ARIA role selector
        strategies += [
            f"text='{text_hint}'",
            f"role=button[name='{text_hint}']",
            f"button:has-text('{text_hint}')",
            f"[type='submit']",
        ]
    else:
        strategies += [
            "button[type='submit']",
            "[type='submit']",
            "button",
        ]

    seen: set[str] = set()
    unique_strategies = [s for s in strategies if not (s in seen or seen.add(s))]   # type: ignore[func-returns-value]

    for i, strat in enumerate(unique_strategies, start=1):
        try:
            await page.wait_for_selector(strat, timeout=_ELEMENT_TIMEOUT_MS)
            await page.click(strat)
            if i > 1:
                log.info(f"[recovery] smart_click: strategy {i} worked → '{strat}'")
            return True
        except Exception as exc:
            log.debug(f"[recovery] smart_click: strategy {i} ('{strat}') failed: {exc}")
            continue

    log.warning(
        f"[recovery] smart_click: ALL strategies failed for element '{text_hint or selector}'"
    )
    return False


# ---------------------------------------------------------------------------
# 3. verify_login_success
# ---------------------------------------------------------------------------

async def verify_login_success(
    page: Page,
    context: BrowserContext,
) -> tuple[bool, str]:
    """
    Heuristic check: did the authentication actually work?

    Checks (in order):
      1. Session cookie presence
      2. Auth failure keywords in visible text
      3. Auth success keywords in visible text
      4. Falls back to assuming success (optimistic default)

    Returns:
        (True, reason_str)  — if login appears successful.
        (False, reason_str) — if login clearly failed.
    """
    # --- Check 1: Session cookie ---
    try:
        cookies = await context.cookies()
        session_cookie = next(
            (c for c in cookies if c.get("name", "").lower() in _SESSION_COOKIE_NAMES),
            None,
        )
        if session_cookie:
            reason = f"Session cookie '{session_cookie['name']}' found → login successful"
            log.info(f"[recovery] verify_login: {reason}")
            return True, reason
    except Exception as exc:
        log.debug(f"[recovery] verify_login: cookie check error: {exc}")

    # --- Check 2: Page text analysis ---
    try:
        visible_text = (await page.inner_text("body")).lower()
    except Exception:
        visible_text = ""

    # Check for failure keywords first (higher priority)
    for kw in _AUTH_FAILURE_KEYWORDS:
        if kw in visible_text:
            reason = f"Login failure keyword detected: '{kw}'"
            log.warning(f"[recovery] verify_login: {reason}")
            return False, reason

    # Check for success keywords
    for kw in _AUTH_SUCCESS_KEYWORDS:
        if kw in visible_text:
            reason = f"Auth success keyword detected: '{kw}'"
            log.info(f"[recovery] verify_login: {reason}")
            return True, reason

    # --- Check 3: URL change (redirect after login is a strong signal) ---
    current_url = page.url.lower()
    if any(term in current_url for term in ["login", "signin", "auth"]):
        reason = "Still on login page after submit — login likely failed"
        log.warning(f"[recovery] verify_login: {reason}")
        return False, reason

    # --- Fallback: assume success, let the agent continue ---
    reason = "No clear signal — assuming login success (optimistic)"
    log.info(f"[recovery] verify_login: {reason}")
    return True, reason


# ---------------------------------------------------------------------------
# 4. safe_navigate
# ---------------------------------------------------------------------------

async def safe_navigate(
    page: Page,
    url: str,
    timeout_ms: int = 30_000,
    wait_until: str = "domcontentloaded",
) -> tuple[bool, str]:
    """
    Navigate to a URL with a timeout guard. Never raises.

    Returns:
        (True,  "SUCCESS: <url>")  on success.
        (False, "TIMEOUT: ...")    on timeout.
        (False, "ERROR: ...")      on any other exception.
    """
    try:
        await page.goto(url, timeout=timeout_ms, wait_until=wait_until)
        msg = f"SUCCESS: Navigated to {url} (HTTP {page.url})"
        log.debug(f"[recovery] safe_navigate: {msg}")
        return True, msg
    except PlaywrightTimeoutError:
        msg = f"TIMEOUT: Navigation to '{url}' timed out after {timeout_ms}ms"
        log.warning(f"[recovery] safe_navigate: {msg}")
        return False, msg
    except Exception as exc:
        msg = f"ERROR: Navigation to '{url}' failed: {exc}"
        log.warning(f"[recovery] safe_navigate: {msg}")
        return False, msg


# ---------------------------------------------------------------------------
# 5. safe_evaluate
# ---------------------------------------------------------------------------

async def safe_evaluate(
    page: Page,
    js_expression: str,
    default: Any = None,
) -> Any:
    """
    Evaluate a JavaScript expression on the page. On ANY error returns `default`.

    Args:
        page:          Playwright page.
        js_expression: JS to evaluate (e.g. "window['__xss_oknexus']").
        default:       Value to return if evaluation fails for any reason.

    Returns:
        The JS return value, or `default` on error.
    """
    try:
        result = await page.evaluate(js_expression)
        log.debug(f"[recovery] safe_evaluate: '{js_expression}' = {result!r}")
        return result
    except Exception as exc:
        log.debug(
            f"[recovery] safe_evaluate: failed evaluating '{js_expression}': {exc}. "
            f"Returning default={default!r}"
        )
        return default
