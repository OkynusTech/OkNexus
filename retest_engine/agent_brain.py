"""
Agent Brain -- manages the multi-turn conversation with Groq LLM.

Each turn:
  1. Receives page state as text
  2. Sends to Groq with full conversation history
  3. Parses the LLM's JSON action response
  4. Returns the action for the orchestrator to execute
"""

import json
import re
from dataclasses import dataclass, field
from typing import Any

from .config import MAX_AGENT_TURNS
from .llm_client import LLMClient, build_llm_client
from .action_schema import ACTION_SCHEMA_TEXT, VALID_ACTIONS
from .logger import get_logger

log = get_logger(__name__)


@dataclass
class AgentTurn:
    """Record of one observe-reason-act cycle."""
    turn_number: int
    page_state_text: str
    action: dict
    action_result: str
    raw_llm_response: str = ""


def _build_system_prompt(vuln_type: str, target_url: str) -> str:
    """Build the system prompt for the agent."""
    return f"""You are an expert penetration tester performing automated vulnerability verification.

## Your Mission
Determine whether a {vuln_type} vulnerability is STILL PRESENT (not_fixed) or has been FIXED (verified)
on the target at {target_url}.

## How This Works
You operate in an observe-reason-act loop:
- After each action, you receive the page state as TEXT (URL, visible text, form fields, buttons, cookies, network responses).
- You must reason about what you observe and decide your next action.
- You have a maximum of {MAX_AGENT_TURNS} turns. Use them wisely.

## Testing Strategy

### IDOR (Insecure Direct Object Reference):
1. Navigate to the login page.
2. Find the login form fields (look at FORM_FIELDS for selectors).
3. Fill in credentials and submit the login form.
4. VERIFY login succeeded: check for session cookie in COOKIES, or check page content changed.
5. Use api_request to access a resource belonging to ANOTHER user (e.g., change user ID in URL).
6. Analyze the HTTP response:
   - HTTP 200 + real user data in body = vulnerability NOT FIXED (still exploitable)
   - HTTP 401/403/404 or access denied = vulnerability VERIFIED as FIXED
7. Issue verdict with the evidence.

### STORED_XSS (Cross-Site Scripting):
1. Navigate to the login page and authenticate.
2. Find the form/input where content can be submitted.
3. Fill the XSS payload into the vulnerable field and submit.
4. Navigate to the page where stored content is rendered (reflection URL).
5. Use evaluate_js to check: window['__xss_oknexus']
   - If result is 1/truthy = XSS NOT FIXED (payload executed)
   - If result is null/undefined/falsy = XSS VERIFIED as FIXED
6. Issue verdict with the evidence.

### REFLECTED_XSS (Reflected Cross-Site Scripting):
1. Authenticate if credentials are provided.
2. Navigate to the vulnerable URL with the XSS payload injected into the vulnerable parameter (from steps to reproduce).
3. Use evaluate_js to check: window['__xss_oknexus']
   - If result is 1/truthy = XSS NOT FIXED (payload executed in reflected context)
   - If result is null/undefined/falsy = XSS VERIFIED as FIXED
4. Issue verdict with the evidence.

### AUTH_BYPASS (Authentication/Authorization Bypass):
1. Navigate to the login page and authenticate with the provided (low-privilege) credentials.
2. VERIFY login succeeded (check cookies, page content).
3. Attempt to access the restricted endpoint/page described in the steps to reproduce.
4. Analyze the response:
   - HTTP 200 + restricted content visible = NOT FIXED (bypass still works)
   - HTTP 401/403/404 or redirect to login = VERIFIED as FIXED
5. Also try: use api_request to directly hit admin/restricted API endpoints.
6. If the steps mention cookie/token manipulation, try removing or modifying auth cookies and re-accessing.
7. Issue verdict with the evidence.

### CSRF (Cross-Site Request Forgery):
1. Navigate to the login page and authenticate.
2. Navigate to the page containing the state-changing form/action from the steps to reproduce.
3. Use evaluate_js to inspect the form for CSRF tokens:
   evaluate_js: document.querySelector('form input[name*="csrf"], form input[name*="token"], form input[name="_token"]')
4. Use api_request to submit the state-changing request WITHOUT any CSRF token.
   - Include the same data fields but omit the CSRF token parameter.
5. Analyze the response:
   - If the request succeeds (HTTP 200/302 with state change) = NOT FIXED
   - If the request is rejected (HTTP 403/422/400 with error about token) = VERIFIED as FIXED
6. Issue verdict with the evidence.

### OPEN_REDIRECT (Unvalidated Redirect):
1. Authenticate if credentials are provided.
2. Navigate to the vulnerable URL with a redirect parameter pointing to an external domain.
   Use payloads like: ?redirect=https://evil.example.com or ?next=//evil.example.com
   (Use the parameter name from the steps to reproduce.)
3. After navigation completes, check the final URL using the page state.
   - If the URL points to the external domain = NOT FIXED (redirect followed)
   - If the URL stays on the target domain or is blocked = VERIFIED as FIXED
4. Try bypass variations if the first payload is blocked:
   - //evil.example.com
   - /\\evil.example.com
   - https://evil.example.com%00@target.com
   - ///evil.example.com
5. Issue verdict with the evidence.

### SQLI (SQL Injection):
1. Authenticate if credentials are provided.
2. From the steps to reproduce, identify the vulnerable endpoint/parameter.
3. Use api_request to send requests with SQL injection payloads from the steps to reproduce.
4. Analyze the response for indicators:
   - Error-based: Look for SQL syntax errors, database error messages in the response body.
   - Union-based: Look for extra data columns or unexpected data in the response.
   - Boolean-based: Compare response to a baseline (same request without injection) -- different content/length = injectable.
   - Time-based: If the payload includes SLEEP/WAITFOR, note if the response took longer than normal.
5. Determine the result:
   - If SQL error messages appear or data is leaked = NOT FIXED
   - If the request is properly handled (parameterized, no errors, no extra data) = VERIFIED as FIXED
6. Issue verdict with the evidence.

## Critical Rules
1. Output ONLY valid JSON. No markdown fences. No explanation outside JSON.
2. Always include "reasoning" explaining your thought process.
3. If an action FAILS, ADAPT:
   - Read the FORM_FIELDS and BUTTONS from the page state.
   - Try different CSS selectors based on what's actually on the page.
   - If a URL doesn't work, try variations.
4. Do NOT guess the verdict. You MUST have concrete evidence (HTTP response, JS evaluation result).
5. If login fails, DO NOT report "verified". Try again or report "inconclusive".
6. When filling forms, use selectors from the FORM_FIELDS list in the page state.
7. When clicking buttons, use selectors from the BUTTONS list in the page state.
8. For IDOR: prefer using api_request (direct HTTP) to test access control -- it gives you the raw response.

## OkNexus Demo Lab Quick Reference (localhost:3000/testvulnapp)
If the target URL contains "testvulnapp", use these known-good selectors and endpoints:

**Login page:** http://localhost:3000/testvulnapp
  - Username field:  selector="#username"   (name="username")
  - Password field:  selector="#password"   (name="password")
  - Submit button:   selector="#login-btn"  (text "Login")
  - Credentials: alice/password123 (admin, id=1), bob/password123 (user, id=2)
  - After login, browser cookie "session_token" is set automatically.

**Comment form (Stored XSS):** on the same page (/testvulnapp)
  - Textarea: selector="#comment"  (name="text")
  - Submit:   selector="#comment-submit"
  - After posting, page redirects back to /testvulnapp where comments render as raw HTML.

**API endpoints (use api_request):**
  - IDOR:         GET  /api/testvulnapp/users/1   (returns SSN if NOT fixed)
  - Auth Bypass:  GET  /api/testvulnapp/admin      (returns secret_key if NOT fixed)
  - CSRF target:  POST /api/testvulnapp/profile    body: {{"bio":"test"}}  (no CSRF token needed)
  - SQLi:         GET  /api/testvulnapp/products?id=PAYLOAD  (SQL error in response if NOT fixed)
  - Open Redirect:GET  /api/testvulnapp/redirect?next=https://evil.example.com
  - Reflected XSS:GET  /api/testvulnapp/search?q=PAYLOAD    (HTML response, check window var)
  - Reset state:  POST /api/testvulnapp/reset

{ACTION_SCHEMA_TEXT}"""


class AgentBrain:
    """Manages the multi-turn Groq conversation."""

    def __init__(
        self,
        vuln_type: str,
        target_url: str,
        steps_to_reproduce: str,
        credentials: dict[str, str],
        xss_payload: str = "",
        llm_client: LLMClient | None = None,
    ):
        self.vuln_type = vuln_type
        self.target_url = target_url
        self.steps_to_reproduce = steps_to_reproduce
        self.credentials = credentials
        self.xss_payload = xss_payload
        self.turns: list[AgentTurn] = []

        self._client = llm_client or build_llm_client()
        log.info(f"Agent brain using LLM: {self._client.provider_name()}")

        # Build conversation
        system_prompt = _build_system_prompt(vuln_type, target_url)
        self.messages: list[dict] = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": self._build_briefing()},
        ]

    def _build_briefing(self) -> str:
        parts = [
            "## Task Briefing",
            f"Vulnerability Type: {self.vuln_type}",
            f"Target URL: {self.target_url}",
            f"Credentials: username={self.credentials.get('username', '?')}, "
            f"password={self.credentials.get('password', '?')}",
            "",
            "Steps to Reproduce (from the original pentest report):",
            self.steps_to_reproduce,
        ]
        if self.vuln_type == "STORED_XSS" and self.xss_payload:
            parts.append("")
            parts.append(f"XSS Payload to inject: {self.xss_payload}")
            parts.append("After injection, check: window['__xss_oknexus'] == 1")

        parts.append("")
        parts.append("You are now on a blank page (about:blank). Take your first action.")
        return "\n".join(parts)

    def decide_next_action(self, page_state_text: str) -> dict:
        """Send current page state to LLM and get next action."""
        observation = (
            f"## Observation (Turn {len(self.turns) + 1})\n\n"
            f"{page_state_text}\n\n"
            f"Decide your next action. Respond with a single JSON object."
        )
        self.messages.append({"role": "user", "content": observation})

        # Trim context if conversation is getting long
        self._trim_context()

        log.debug(f"Agent brain: turn {len(self.turns) + 1}, "
                  f"{len(self.messages)} messages in context")

        raw = self._client.chat(self.messages, temperature=0.1, max_tokens=1024)
        log.debug(f"Agent brain raw: {raw[:300]}")

        action = self._parse_action(raw)
        self.messages.append({"role": "assistant", "content": raw})

        return action

    def record_turn(self, turn: AgentTurn) -> None:
        """Record a completed turn."""
        self.turns.append(turn)

    def feed_action_result(self, result_text: str) -> None:
        """Feed the execution result back into the conversation."""
        self.messages.append({
            "role": "user",
            "content": f"[ACTION RESULT]: {result_text}"
        })

    def _trim_context(self) -> None:
        """
        Compress old messages if the conversation is getting too long.

        Keeps: system prompt (index 0), briefing (index 1), and the last 8 messages.
        Summarizes everything in between into a single message.
        """
        if len(self.messages) <= 20:
            return

        # Keep first 2 (system + briefing) and last 8
        keep_head = 2
        keep_tail = 8
        middle = self.messages[keep_head:-keep_tail]

        if not middle:
            return

        # Build a compact summary of the middle messages
        summary_parts = ["[CONTEXT SUMMARY - Previous turns compressed]"]
        turn_count = 0
        for msg in middle:
            content = msg.get("content", "")
            if msg["role"] == "user" and content.startswith("## Observation"):
                turn_count += 1
            elif msg["role"] == "assistant":
                # Extract just the action type and reasoning
                try:
                    action = json.loads(content.strip().lstrip('`').lstrip('json').strip())
                    summary_parts.append(
                        f"Turn {turn_count}: {action.get('action', '?')} - "
                        f"{action.get('reasoning', '')[:80]}"
                    )
                except (json.JSONDecodeError, ValueError):
                    summary_parts.append(f"Turn {turn_count}: {content[:80]}")
            elif "[ACTION RESULT]" in content:
                result_brief = content.replace("[ACTION RESULT]: ", "")[:100]
                summary_parts.append(f"  Result: {result_brief}")

        summary = "\n".join(summary_parts)
        log.info(f"Trimming context: {len(middle)} messages -> 1 summary "
                 f"({len(self.messages)} -> {keep_head + 1 + keep_tail} messages)")

        self.messages = (
            self.messages[:keep_head]
            + [{"role": "user", "content": summary}]
            + self.messages[-keep_tail:]
        )

    def _parse_action(self, raw: str) -> dict:
        """Parse and validate the LLM's JSON action response."""
        action = _repair_json(raw)
        if action is None:
            raise ValueError(f"Could not parse JSON from LLM: {raw[:200]}")

        action_type = action.get("action", "")
        if action_type not in VALID_ACTIONS:
            raise ValueError(
                f"Unknown action '{action_type}'. Valid: {sorted(VALID_ACTIONS)}"
            )

        return action


def _repair_json(raw: str) -> dict | None:
    """
    Attempt to extract a valid JSON object from raw LLM output.

    Strategies:
      1. Strip markdown fences and try json.loads directly
      2. Find outermost {...} via brace-depth counting
      3. Try each candidate substring
    """
    # Strategy 1: strip markdown fences
    cleaned = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
    cleaned = re.sub(r"\s*```\s*$", "", cleaned, flags=re.MULTILINE)
    cleaned = cleaned.strip()

    try:
        return json.loads(cleaned)
    except (json.JSONDecodeError, ValueError):
        pass

    # Strategy 2: brace-depth counting to find outermost JSON object
    candidates = _extract_json_candidates(cleaned)
    for candidate in candidates:
        try:
            return json.loads(candidate)
        except (json.JSONDecodeError, ValueError):
            continue

    # Strategy 3: try on the original raw text too
    if cleaned != raw.strip():
        candidates = _extract_json_candidates(raw.strip())
        for candidate in candidates:
            try:
                return json.loads(candidate)
            except (json.JSONDecodeError, ValueError):
                continue

    return None


def _extract_json_candidates(text: str) -> list[str]:
    """Extract potential JSON object substrings using brace-depth counting."""
    candidates = []
    depth = 0
    start = -1
    in_string = False
    escape_next = False

    for i, ch in enumerate(text):
        if escape_next:
            escape_next = False
            continue
        if ch == '\\' and in_string:
            escape_next = True
            continue
        if ch == '"' and not escape_next:
            in_string = not in_string
            continue
        if in_string:
            continue

        if ch == '{':
            if depth == 0:
                start = i
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0 and start >= 0:
                candidates.append(text[start:i + 1])
                start = -1

    return candidates
