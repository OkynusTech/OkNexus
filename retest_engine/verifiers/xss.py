"""
Phase 3 — Stored XSS Verification.

Strategy
--------
1. Login using the provided credentials.
2. Navigate to the injection form identified by the planner.
3. Inject the XSS marker payload into the vulnerable field.
4. Submit the form / trigger storage.
5. Navigate to the reflection URL (where the stored payload renders).
6. Evaluate whether the marker executed in the page's JS context.
7. Capture a screenshot as proof.

The marker payload sets window['__xss_oknexus'] = 1 via an onerror handler,
avoiding noisy alert() calls while remaining detectable via page.evaluate().

Returns a VerificationResult dict:
  {
    "success":    bool,    # True = payload executed = NOT fixed
    "confidence": float,
    "evidence":   dict,
  }
"""

from typing import Any

from ..config import XSS_MARKER_PAYLOAD, XSS_MARKER_EXPR
from ..executor import browser_session, run_actions
from ..logger import get_logger

log = get_logger(__name__)

# How long to wait (ms) for the DOM to settle after navigating to the reflection URL
_DOM_SETTLE_MS = 2000


async def verify(
    plan: dict[str, Any],
    credentials: dict[str, str],
) -> dict[str, Any]:
    """
    Run Stored XSS verification.

    Args:
        plan:        Action plan from the planner (must include injection_selector
                     and reflection_url for XSS).
        credentials: {"username": "...", "password": "..."}

    Returns:
        VerificationResult dict.
    """
    log.info("Starting Stored XSS verification")

    login_actions     = plan.get("login_actions", [])
    test_actions      = plan.get("test_actions",  [])
    injection_selector = plan.get("injection_selector")
    reflection_url    = plan.get("reflection_url")

    if not injection_selector:
        log.warning("No injection_selector in plan — cannot run XSS test")
        return _result(
            success=False,
            confidence=0.1,
            evidence={"reason": "Planner did not identify an injection selector."},
        )

    variables = {
        "USERNAME":    credentials.get("username", ""),
        "PASSWORD":    credentials.get("password", ""),
        "XSS_PAYLOAD": XSS_MARKER_PAYLOAD,
    }

    async with browser_session() as (page, context, exec_result):

        # ── Step 1: Login ─────────────────────────────────────────────────
        log.info("Running login actions")
        login_ok = await run_actions(page, exec_result, login_actions, variables)
        if not login_ok:
            log.error("Login failed — cannot proceed with XSS test")
            return _result(
                success=False,
                confidence=0.0,
                evidence={"error": "login_failed", "logs": exec_result.logs},
            )

        # ── Step 2: Execute test actions (navigate + inject + submit) ─────
        # test_actions already include the fill step with {{XSS_PAYLOAD}}.
        # The variables dict above substitutes it with the real payload.
        log.info("Running test actions (inject payload)")
        await run_actions(
            page, exec_result, test_actions, variables, stop_on_error=False
        )

        # ── Step 3: Wait for DOM to settle after submission ───────────────
        log.info(f"Waiting {_DOM_SETTLE_MS}ms for DOM to settle")
        import asyncio
        await asyncio.sleep(_DOM_SETTLE_MS / 1000)

        # ── Step 4: Navigate to the reflection URL ────────────────────────
        if reflection_url:
            log.info(f"Navigating to reflection URL: {reflection_url}")
            try:
                await page.goto(
                    reflection_url,
                    wait_until="domcontentloaded",
                    timeout=30000,
                )
                await asyncio.sleep(_DOM_SETTLE_MS / 1000)
            except Exception as exc:
                log.error(f"Failed to navigate to reflection_url: {exc}")
                exec_result.logs.append({
                    "level": "error",
                    "msg":   f"reflection_url navigation failed: {exc}",
                    "time":  _now(),
                })
        else:
            log.warning(
                "No reflection_url in plan — checking current page for payload execution"
            )

        # ── Step 5: Capture screenshot of the reflection page ────────────
        from ..executor import _take_screenshot
        await _take_screenshot(page, exec_result, "xss_reflection_page")

        # ── Step 6: Check if marker executed ─────────────────────────────
        executed = False
        try:
            marker_value = await page.evaluate(XSS_MARKER_EXPR)
            executed = bool(marker_value)
            log.info(f"XSS marker eval result: {marker_value!r} → executed={executed}")
        except Exception as exc:
            log.warning(f"page.evaluate failed (may be expected if navigated away): {exc}")

        # Also check for any dialog (alert/confirm) that fired
        if not executed:
            executed = _check_logs_for_xss(exec_result.logs)
            if executed:
                log.info("XSS marker detected via console log pattern")

        return _result(
            success=executed,
            confidence=0.95 if executed else 0.80,
            evidence={
                "payload_used":    XSS_MARKER_PAYLOAD,
                "reflection_url":  reflection_url,
                "marker_executed": executed,
                "screenshots":     exec_result.screenshots,
                "logs":            exec_result.logs[-20:],  # last 20 entries
                "network_data":    exec_result.network_data[:10],
            },
        )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _check_logs_for_xss(logs: list[dict]) -> bool:
    """
    Fallback: scan browser console logs for any sign the payload executed.
    Looks for common XSS canary patterns.
    """
    for entry in logs:
        msg = entry.get("msg", "").lower()
        if "__xss_oknexus" in msg or "xss" in msg:
            return True
    return False


def _result(success: bool, confidence: float, evidence: dict) -> dict:
    return {"success": success, "confidence": confidence, "evidence": evidence}


def _now() -> str:
    import time
    return time.strftime("%Y-%m-%dT%H:%M:%S")
