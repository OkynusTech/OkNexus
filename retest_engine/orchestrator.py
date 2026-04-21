"""
Agentic Orchestrator -- observe-reason-act loop.

Replaces the old linear plan-execute-verify pipeline.

The agent:
  1. Takes an action (decided by agent_brain via Groq LLM)
  2. Executes it in the browser (via Playwright)
  3. Extracts page state as text (via page_state)
  4. Sends state back to agent_brain for reasoning
  5. Repeats until verdict or max turns
"""

import asyncio
import time
import traceback
from typing import Any

from .agent_brain import AgentBrain, AgentTurn
from .auth import setup_auth
from .page_state import extract_page_state, state_to_text, focused_state_to_text
from .executor import browser_session, _take_screenshot, ExecutionResult
from .state_machine import RetestFSM
from .recovery import smart_fill, smart_click, safe_navigate, safe_evaluate, verify_login_success
from .quick_check import quick_check
from .config import (
    MAX_AGENT_TURNS, BROWSER_TIMEOUT_MS,
    XSS_MARKER_PAYLOAD, XSS_MARKER_EXPR,
)
from .decision import (
    check_idor, check_xss, check_open_redirect,
    check_auth_bypass,
)
from .logger import get_logger

log = get_logger(__name__)

_SUPPORTED_TYPES = {
    "IDOR", "STORED_XSS", "AUTH_BYPASS", "CSRF",
    "OPEN_REDIRECT", "REFLECTED_XSS", "SQLI",
}

# Adaptive turn budgets per vulnerability type
_TURN_BUDGET = {
    "OPEN_REDIRECT": 8,
    "CSRF": 10,
    "REFLECTED_XSS": 10,
    "IDOR": 12,
    "AUTH_BYPASS": 12,
    "STORED_XSS": 15,
    "SQLI": 15,
}


async def run(retest_request: dict[str, Any], event_bus=None) -> dict[str, Any]:
    """Orchestrate the agentic retest loop. Optionally emits events to event_bus."""
    retest_id   = retest_request.get("retest_id", "unknown")
    vuln_type   = str(retest_request.get("vulnerability_type", "")).upper()
    target_url  = retest_request.get("target_url", "")
    steps       = retest_request.get("steps_to_reproduce", "")
    credentials = retest_request.get("credentials", {})

    log.info(f"=== Agentic retest started: id={retest_id} type={vuln_type} ===")

    def _abort(err_msg: str):
        res = _output(retest_id, "failed", _empty_evidence(), error=err_msg)
        if event_bus:
            event_bus.emit("complete", res)
        return res

    # -- Input validation --
    if vuln_type not in _SUPPORTED_TYPES:
        return _abort(f"Unsupported type '{vuln_type}'")
    if not target_url:
        return _abort("target_url is empty")
    auth_type_check = credentials.get("auth_type", "form")
    if auth_type_check == "form":
        if not credentials.get("username") or not credentials.get("password"):
            return _abort("missing credentials (username/password required for form login)")
    elif auth_type_check == "bearer_token":
        if not credentials.get("token"):
            return _abort("missing token for bearer_token auth")
    elif auth_type_check == "cookie":
        if not credentials.get("cookies"):
            return _abort("missing cookies for cookie auth")

    # ── QUICK CHECK PRE-FLIGHT ─────────────────────────────────────────────────
    # For URL-based vulns (IDOR, Open Redirect, Auth Bypass, Reflected XSS):
    # Try a direct HTTP request BEFORE launching the browser or calling the LLM.
    # If conclusive → return verdict immediately (0 LLM tokens, <1 second).
    # If inconclusive → fall through to full agentic loop below.
    quick_verdict = quick_check(
        vuln_type=vuln_type,
        target_url=target_url,
        credentials=credentials,
        steps_to_reproduce=steps,
    )
    if quick_verdict:
        log.info(
            f"[quick_check] Pre-flight conclusive: {quick_verdict['status']} "
            f"(confidence={quick_verdict['confidence']:.2f}) — skipping full agent loop"
        )
        evidence = _empty_evidence()
        evidence["details"] = {
            "confidence": quick_verdict["confidence"],
            "reason": quick_verdict["summary"],
            "reasoning_chain": "Determined by HTTP pre-flight check (no LLM used).",
            "turns_used": 0,
            "max_turns": 0,
            "agent_turns": [],
            "source": "quick_check",
        }
        status = _map_verdict(quick_verdict)
        result = _output(retest_id, status, evidence)
        if event_bus:
            event_bus.emit("verdict", {
                "status": quick_verdict["status"],
                "confidence": quick_verdict["confidence"],
                "summary": quick_verdict["summary"],
            })
            event_bus.emit("complete", result)
        return result

    log.info("[quick_check] Pre-flight inconclusive — launching full agentic loop")

    # ── REFLECTED XSS BROWSER SHORTCUT (No LLM) ───────────────────────────────
    # If the URL already contains our XSS marker, we don't need to ask the LLM
    # what action to take — we KNOW the action is "navigate then eval JS".
    # Skip the entire LLM loop and just do: navigate → check marker → verdict.
    if vuln_type == "REFLECTED_XSS" and "__xss_oknexus" in target_url:
        log.info("[rxss_shortcut] Marker URL detected — using browser shortcut (no LLM)")
        xss_verdict = await _reflected_xss_browser_check(target_url, retest_id, event_bus)
        if xss_verdict:
            return xss_verdict

    # -- Initialize agent brain --
    xss_payload = XSS_MARKER_PAYLOAD if vuln_type == "STORED_XSS" else ""
    try:
        brain = AgentBrain(
            vuln_type=vuln_type,
            target_url=target_url,
            steps_to_reproduce=steps,
            credentials=credentials,
            xss_payload=xss_payload,
        )
    except EnvironmentError as exc:
        return _abort(str(exc))


    # -- Run agent loop inside browser session --
    async with browser_session() as (page, context, exec_result):

        last_response = None
        verdict = None

        # Intercept network responses for state extraction
        async def _on_response_for_state(resp):
            nonlocal last_response
            try:
                body = await resp.text()
            except Exception:
                body = ""
            last_response = {
                "url": resp.url,
                "method": resp.request.method,
                "status": resp.status,
                "body_snippet": body[:2000],
            }

        page.on("response", _on_response_for_state)

        # Set up pre-authentication if auth_type is not "form"
        auth_type = credentials.get("auth_type", "form")
        if auth_type != "form":
            auth_ok = await setup_auth(page, context, credentials)
            if not auth_ok:
                return _abort(f"Authentication setup failed for type '{auth_type}'")

        # Setup FSM
        fsm = RetestFSM(vuln_type)

        parse_failures = 0
        low_confidence_bounced = False
        effective_max_turns = _TURN_BUDGET.get(vuln_type, MAX_AGENT_TURNS)
        login_verified = False  # tracks whether we confirmed login success

        def _emit(event_type: str, data: dict):
            if event_bus:
                event_bus.emit(event_type, data)

        for turn_num in range(1, effective_max_turns + 1):
            log.info(f"--- Turn {turn_num}/{effective_max_turns} ---")
            _emit("turn_start", {"turn": turn_num, "max_turns": effective_max_turns})

            # OBSERVE: extract current page state
            stage_name = fsm.current_stage().name
            try:
                state = await extract_page_state(page, context, last_response)
                state_text = focused_state_to_text(state, stage_name)
            except Exception as exc:
                log.warning(f"State extraction error: {exc}")
                # Fallback: minimal state with just the URL
                from .page_state import PageState
                fallback_state = PageState(url=page.url, error=str(exc))
                state_text = state_to_text(fallback_state)

            # REASON: ask the brain for next action
            try:
                action = brain.decide_next_action(
                    state_text,
                    fsm.current_stage().name,
                    fsm.current_stage().instruction,
                )
                parse_failures = 0  # reset on success
            except Exception as exc:
                parse_failures += 1
                log.error(f"Agent brain error (attempt {parse_failures}): {exc}")
                if parse_failures >= 3:
                    log.error("Three consecutive parse failures, stopping.")
                    break
                brain.feed_action_result(
                    f"ERROR: Could not parse your response: {exc}.\n"
                    f"You MUST respond with ONLY a valid JSON object. Example:\n"
                    f'{{"action": "navigate", "url": "http://example.com", '
                    f'"reasoning": "Going to the target to begin testing"}}'
                )
                continue

            action_type = action.get("action", "")
            reasoning = action.get("reasoning", "")

            if not fsm.is_action_allowed(action_type):
                allowed = sorted(fsm.allowed_actions_for_current_stage())
                action_result = (
                    f"ERROR: Action '{action_type}' is not allowed in stage '{fsm.current_stage().name}'. "
                    f"Allowed actions: {allowed}."
                )
                log.warning(f"  FSM Guardrail: {action_result}")
                brain.feed_action_result(action_result)
                continue

            log.info(f"  Action: {action_type} | Reasoning: {reasoning[:120]}")
            _emit("turn_action", {
                "turn": turn_num,
                "action": action_type,
                "reasoning": reasoning[:200],
            })

            # CHECK FOR VERDICT
            if action_type == "verdict":
                confidence = action.get("confidence", 0)
                remaining_turns = effective_max_turns - turn_num

                # Bounce back once if confidence is low and turns remain
                if confidence < 0.6 and not low_confidence_bounced and remaining_turns >= 2:
                    low_confidence_bounced = True
                    log.info(
                        f"  Low confidence ({confidence:.2f}), bouncing back. "
                        f"{remaining_turns} turns remain."
                    )
                    brain.feed_action_result(
                        f"Your confidence is low ({confidence:.2f}). "
                        f"You have {remaining_turns} turns left. "
                        f"Can you gather more evidence before concluding? "
                        f"If not, re-issue your verdict."
                    )
                    continue

                verdict = action
                log.info(f"  VERDICT: {action.get('status')} "
                         f"(confidence={confidence:.2f})")
                _emit("verdict", {
                    "status": action.get("status"),
                    "confidence": confidence,
                    "summary": action.get("summary", ""),
                })
                # Take final screenshot
                await _take_screenshot(page, exec_result, "final_state")
                break

            # CHECK FOR NEXT STAGE
            if action_type == "next_stage":
                if fsm.advance():
                    action_result = f"SUCCESS: Advanced to stage {fsm.current_stage().name}."
                else:
                    action_result = "ERROR: Already at the final stage."
                
                log.info(f"  FSM: {action_result}")
                brain.feed_action_result(action_result)
                continue

            # ACT: execute the action
            action_result = await _execute_action(
                page, context, exec_result, action, turn_num
            )
            log.info(f"  Result: {action_result[:150]}")
            _emit("turn_result", {
                "turn": turn_num,
                "result": action_result[:300],
            })

            # Take a screenshot after every action for evidence
            await _take_screenshot(page, exec_result, f"turn_{turn_num}")

            # ── DETERMINISTIC PRE-CHECK ───────────────────────────────────
            # Try to reach a verdict from hard evidence before the next LLM call.
            # This avoids wasting a turn just to ask the LLM something obvious.
            det_verdict = await _run_deterministic_check(
                vuln_type, page, last_response, action, action_result
            )
            if det_verdict:
                log.info(
                    f"  [DET] Deterministic verdict: {det_verdict['status']} "
                    f"(confidence={det_verdict['confidence']:.2f})"
                )
                _emit("verdict", det_verdict)
                await _take_screenshot(page, exec_result, "deterministic_verdict")
                verdict = {
                    "action": "verdict",
                    **det_verdict,
                    "reasoning": det_verdict["summary"],
                }
                break

            # ── LOGIN SUCCESS CHECK ───────────────────────────────────────
            # After the first few turns, verify login actually worked.
            # If it failed, abort immediately — wrong verdicts are worse than no verdict.
            if not login_verified and turn_num <= 3 and action_type in ("click", "fill"):
                try:
                    login_ok, login_reason = await verify_login_success(page, context)
                    if not login_ok:
                        log.warning(
                            "  [AUTH] Login appears to have failed — aborting retest "
                            "to avoid a false verdict."
                        )
                        verdict = {
                            "action": "verdict",
                            "status": "failed",
                            "confidence": 0.85,
                            "summary": (
                                "Authentication failed. Cannot determine vulnerability status "
                                "without a valid session."
                            ),
                            "reasoning": f"Login failure detected after credential submission. Reason: {login_reason}",
                        }
                        break
                    else:
                        login_verified = True
                        log.info(f"  [AUTH] Login confirmed — continuing retest. ({login_reason})")
                except Exception as exc:
                    log.warning(f"  [AUTH] Could not verify login state: {exc}")

            # Record turn
            turn = AgentTurn(
                turn_number=turn_num,
                page_state_text=state_text[:500],  # truncate for storage
                action=action,
                action_result=action_result,
            )
            brain.record_turn(turn)
            brain.feed_action_result(action_result)

        # -- Force verdict if none issued --
        if verdict is None:
            log.warning("Agent exhausted turns without issuing a verdict.")
            verdict = {
                "action": "verdict",
                "status": "inconclusive",
                "confidence": 0.2,
                "summary": "Agent could not determine vulnerability status within the turn limit.",
                "reasoning": "Max turns reached without definitive evidence.",
            }

    # -- Map verdict to engine status --
    status = _map_verdict(verdict)

    # -- Assemble evidence --
    evidence = {
        "screenshots": exec_result.screenshots,
        "logs": exec_result.logs,
        "network_data": exec_result.network_data[:40],
        "details": {
            "confidence": verdict.get("confidence", 0.0),
            "reason": verdict.get("summary", ""),
            "reasoning_chain": verdict.get("reasoning", ""),
            "turns_used": len(brain.turns),
            "max_turns": effective_max_turns,
            "agent_turns": [
                {
                    "turn": t.turn_number,
                    "action": t.action.get("action", ""),
                    "reasoning": t.action.get("reasoning", ""),
                    "result": t.action_result[:800],
                }
                for t in brain.turns
            ],
        },
    }

    log.info(f"=== Agentic retest completed: id={retest_id} "
             f"status={status} turns={len(brain.turns)} ===")

    result = _output(retest_id, status, evidence)
    if event_bus:
        event_bus.emit("complete", result)
    return result


# ---------------------------------------------------------------------------
# Single-action executor
# ---------------------------------------------------------------------------

_RETRYABLE_ERRORS = ("timeout", "navigation", "net::ERR_")

def _is_retryable(exc: Exception) -> bool:
    """Check if an exception is a transient/retryable error."""
    if isinstance(exc, (TimeoutError, asyncio.TimeoutError)):
        return True
    msg = str(exc).lower()
    return any(keyword in msg for keyword in _RETRYABLE_ERRORS)


async def _execute_action(
    page, context, exec_result: ExecutionResult,
    action: dict, turn_num: int,
) -> str:
    """
    Execute one agent action on the browser with retry for transient failures.
    Returns a text description of the result for the brain.
    """
    max_retries = 2
    last_error = None

    for attempt in range(1, max_retries + 2):  # 1 initial + 2 retries
        try:
            return await _do_execute_action(page, context, action)
        except Exception as exc:
            last_error = exc
            if attempt <= max_retries and _is_retryable(exc):
                log.warning(
                    f"  Retryable error on attempt {attempt}: {exc}. "
                    f"Retrying in 1s..."
                )
                await asyncio.sleep(1)
                continue
            # Non-retryable or retries exhausted
            break

    error_msg = f"ERROR: {action.get('action', '')} failed: {last_error}"
    exec_result.logs.append({
        "level": "error",
        "msg": error_msg,
        "time": time.strftime("%Y-%m-%dT%H:%M:%S"),
    })
    await _take_screenshot(page, exec_result, f"error_turn{turn_num}")
    return error_msg


async def _do_execute_action(page, context, action: dict) -> str:
    """Core action execution logic (no retry wrapper)."""
    atype = action.get("action", "")

    if atype == "navigate":
        url = action["url"]
        ok, msg = await safe_navigate(page, url, timeout_ms=BROWSER_TIMEOUT_MS)
        return msg

    elif atype == "fill":
        selector = action["selector"]
        value = action.get("value", "")
        # Extract a human-readable field hint from the selector for smarter fallbacks
        field_hint = action.get("field_hint", "")
        if not field_hint:
            # Parse hint from selector (e.g. "#username" or "[name='username']")
            import re as _re
            m = _re.search(r'[#\[](?:id=|name=|placeholder=)?([\w-]+)', selector)
            field_hint = m.group(1) if m else ""
        ok = await smart_fill(page, selector, value, field_hint=field_hint)
        if not ok:
            return f"ERROR: Could not fill field '{selector}' (tried 4 fallback strategies)"
        display = "***" if "password" in selector.lower() else value[:50]
        return f"SUCCESS: Filled '{selector}' with '{display}'"

    elif atype == "click":
        selector = action["selector"]
        text_hint = action.get("text_hint", "")
        ok = await smart_click(page, selector, text_hint=text_hint)
        await asyncio.sleep(1)  # brief wait for navigation/response
        if not ok:
            return f"ERROR: Could not click '{selector}' (tried 4 fallback strategies)"
        return f"SUCCESS: Clicked '{selector}'. Page now at {page.url}"

    elif atype == "api_request":
        method = action.get("method", "GET").upper()
        url = action["url"]
        headers = action.get("headers", {})
        body = action.get("body")

        if method == "GET":
            resp = await page.request.get(
                url, headers=headers, timeout=BROWSER_TIMEOUT_MS
            )
        elif method == "POST":
            resp = await page.request.post(
                url, headers=headers, data=body,
                timeout=BROWSER_TIMEOUT_MS
            )
        else:
            resp = await page.request.fetch(
                url, method=method, headers=headers,
                data=body, timeout=BROWSER_TIMEOUT_MS
            )

        resp_text = await resp.text()
        return (
            f"SUCCESS: {method} {url} -> HTTP {resp.status}. "
            f"Body ({len(resp_text)} chars): {resp_text[:500]}"
        )

    elif atype == "evaluate_js":
        expr = action["expression"]
        result = await safe_evaluate(page, expr, default=None)
        return f"SUCCESS: evaluate('{expr}') returned: {result!r}"

    elif atype == "wait":
        ms = int(action.get("ms", 1000))
        await asyncio.sleep(ms / 1000)
        return f"SUCCESS: Waited {ms}ms"

    elif atype == "extract_form_tokens":
        selector = action.get("selector", "form")
        tokens = await page.evaluate(f"""() => {{
            const form = document.querySelector('{selector}');
            if (!form) return [];
            const hiddens = form.querySelectorAll('input[type="hidden"]');
            return Array.from(hiddens).map(el => ({{
                name: el.name || '',
                value: (el.value || '').substring(0, 200),
                id: el.id || ''
            }}));
        }}""")
        import json as _json
        return f"SUCCESS: Found {len(tokens)} hidden fields: {_json.dumps(tokens)}"

    elif atype == "check_redirect":
        url = action["url"]
        status = "unknown"
        try:
            # Use "commit" so we capture the final URL immediately after the
            # redirect chain completes, before the destination page finishes
            # loading.  This prevents a TimeoutError when the external target
            # (e.g. evil.example.com) is unreachable.
            resp = await page.goto(
                url, timeout=BROWSER_TIMEOUT_MS,
                wait_until="commit"
            )
            status = resp.status if resp else "unknown"
        except Exception:
            # Even on load-error we still report where the browser ended up.
            pass
        final_url = page.url
        return (
            f"SUCCESS: Navigated to {url} -> Final URL: {final_url} "
            f"(HTTP {status})"
        )

    else:
        return f"ERROR: Unknown action type '{atype}'"


# ---------------------------------------------------------------------------
# Deterministic check helper
# ---------------------------------------------------------------------------

async def _run_deterministic_check(
    vuln_type: str,
    page,
    last_response: dict | None,
    action: dict,
    action_result: str,
) -> dict | None:
    """
    After each action, check if we already have enough evidence to issue a
    verdict WITHOUT calling the LLM again.

    Returns a verdict dict if confident, None if we need the LLM to decide.
    """
    if not last_response:
        return None

    http_status = last_response.get("status", 0)
    response_body = last_response.get("body_snippet", "")
    action_type = action.get("action", "")

    # Only run checks after meaningful actions (not just navigation)
    if action_type not in ("api_request", "click", "check_redirect", "evaluate_js"):
        return None

    if vuln_type == "IDOR" and action_type == "api_request":
        return check_idor(http_status, response_body)

    elif vuln_type in ("STORED_XSS", "REFLECTED_XSS") and action_type == "evaluate_js":
        # The JS marker check result is in the action_result string
        js_executed = "returned: 1" in action_result or "returned: true" in action_result.lower()
        js_evaluated = "SUCCESS: evaluate" in action_result
        if js_evaluated:
            return check_xss(1 if js_executed else 0)
        return None

    elif vuln_type == "OPEN_REDIRECT" and action_type == "check_redirect":
        # Extract initial and final URLs from action_result
        # action_result looks like: "SUCCESS: Navigated to <url> -> Final URL: <url> (HTTP ...)"
        try:
            initial_url = action.get("url", "")
            # Parse final URL from result string
            if "Final URL:" in action_result:
                final_url = action_result.split("Final URL:")[1].split("(")[0].strip()
                return check_open_redirect(initial_url, final_url)
        except Exception:
            pass
        return None

    elif vuln_type == "AUTH_BYPASS" and action_type == "api_request":
        return check_auth_bypass(http_status, response_body)

    return None


# ---------------------------------------------------------------------------
# Reflected XSS Browser Shortcut (no LLM)
# ---------------------------------------------------------------------------

async def _reflected_xss_browser_check(
    target_url: str,
    retest_id: str,
    event_bus=None,
) -> dict | None:
    """
    Navigate to a Reflected XSS URL that already contains our marker payload,
    evaluate window['__xss_oknexus'] in the browser, and return a verdict.

    No LLM involved — just: launch browser → navigate → eval JS → verdict.
    Returns a full result dict on success, None if something goes wrong
    (caller falls through to full agent loop).
    """
    try:
        async with browser_session() as (page, ctx, exec_result):
            ok, nav_msg = await safe_navigate(page, target_url, timeout_ms=BROWSER_TIMEOUT_MS)
            if not ok:
                log.warning(f"[rxss_shortcut] Navigation failed: {nav_msg}")
                return None

            # Wait briefly for any scripts to execute
            await asyncio.sleep(1.5)

            # Evaluate our JS marker
            marker_value = await safe_evaluate(page, XSS_MARKER_EXPR, default=None)
            log.info(f"[rxss_shortcut] {XSS_MARKER_EXPR} = {marker_value!r}")

            # Take a screenshot as evidence
            await _take_screenshot(page, exec_result, "rxss_shortcut")

            # Determine verdict from marker value
            xss_fired = bool(marker_value)
            verdict_dict = check_xss(1 if xss_fired else 0)
            if not verdict_dict:
                return None

            verdict_dict["source"] = "rxss_browser_shortcut"
            status = _map_verdict(verdict_dict)
            evidence = {
                "screenshots": exec_result.screenshots,
                "logs": exec_result.logs,
                "network_data": [],
                "details": {
                    "confidence": verdict_dict["confidence"],
                    "reason": verdict_dict["summary"],
                    "reasoning_chain": (
                        f"Browser shortcut: navigated to marker URL, "
                        f"evaluated {XSS_MARKER_EXPR} = {marker_value!r}. "
                        f"No LLM used."
                    ),
                    "turns_used": 1,
                    "max_turns": 1,
                    "agent_turns": [],
                    "source": "rxss_browser_shortcut",
                },
            }
            result = _output(retest_id, status, evidence)
            if event_bus:
                event_bus.emit("verdict", {
                    "status": verdict_dict["status"],
                    "confidence": verdict_dict["confidence"],
                    "summary": verdict_dict["summary"],
                })
                event_bus.emit("complete", result)
            return result

    except Exception as exc:
        log.warning(f"[rxss_shortcut] Error, falling back to full agent: {exc}")
        return None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _map_verdict(verdict: dict) -> str:
    """Map agent verdict to engine status."""
    v = verdict.get("status", "").lower()
    if v == "not_fixed":
        return "not_fixed"
    elif v in ("verified", "fixed"):
        return "verified"
    else:
        return "failed"  # inconclusive or unknown


def _empty_evidence() -> dict:
    return {"screenshots": [], "logs": [], "network_data": [], "details": {}}


def _output(retest_id: str, status: str, evidence: dict,
            error: str | None = None) -> dict:
    result = {"retest_id": retest_id, "status": status, "evidence": evidence}
    if error:
        result["error"] = error
    return result
