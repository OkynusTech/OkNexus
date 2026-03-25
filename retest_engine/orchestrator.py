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
from .page_state import extract_page_state, state_to_text
from .executor import browser_session, _take_screenshot, ExecutionResult
from .config import (
    MAX_AGENT_TURNS, BROWSER_TIMEOUT_MS,
    XSS_MARKER_PAYLOAD,
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

        parse_failures = 0
        low_confidence_bounced = False
        effective_max_turns = _TURN_BUDGET.get(vuln_type, MAX_AGENT_TURNS)

        def _emit(event_type: str, data: dict):
            if event_bus:
                event_bus.emit(event_type, data)

        for turn_num in range(1, effective_max_turns + 1):
            log.info(f"--- Turn {turn_num}/{effective_max_turns} ---")
            _emit("turn_start", {"turn": turn_num, "max_turns": effective_max_turns})

            # OBSERVE: extract current page state
            try:
                state = await extract_page_state(page, context, last_response)
                state_text = state_to_text(state)
            except Exception as exc:
                log.warning(f"State extraction error: {exc}")
                # Fallback: minimal state with just the URL
                from .page_state import PageState
                fallback_state = PageState(url=page.url, error=str(exc))
                state_text = state_to_text(fallback_state)

            # REASON: ask the brain for next action
            try:
                action = brain.decide_next_action(state_text)
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
        resp = await page.goto(
            url, timeout=BROWSER_TIMEOUT_MS,
            wait_until="domcontentloaded"
        )
        status = resp.status if resp else "unknown"
        return f"SUCCESS: Navigated to {url} (HTTP {status})"

    elif atype == "fill":
        selector = action["selector"]
        value = action.get("value", "")
        await page.wait_for_selector(selector, timeout=10000)
        await page.fill(selector, value)
        display = "***" if "password" in selector.lower() else value[:50]
        return f"SUCCESS: Filled '{selector}' with '{display}'"

    elif atype == "click":
        selector = action["selector"]
        await page.wait_for_selector(selector, timeout=10000)
        await page.click(selector)
        await asyncio.sleep(1)  # brief wait for navigation/response
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
        result = await page.evaluate(expr)
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
