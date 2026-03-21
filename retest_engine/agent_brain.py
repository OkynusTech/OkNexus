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

from groq import Groq

from .config import GROQ_API_KEY, GROQ_MODEL, MAX_AGENT_TURNS
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
    ):
        if not GROQ_API_KEY:
            raise EnvironmentError("GROQ_API_KEY is not set.")

        self.vuln_type = vuln_type
        self.target_url = target_url
        self.steps_to_reproduce = steps_to_reproduce
        self.credentials = credentials
        self.xss_payload = xss_payload
        self.turns: list[AgentTurn] = []

        self._client = Groq(api_key=GROQ_API_KEY)

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

        log.debug(f"Agent brain: turn {len(self.turns) + 1}, "
                  f"{len(self.messages)} messages in context")

        response = self._client.chat.completions.create(
            model=GROQ_MODEL,
            messages=self.messages,
            temperature=0.1,
            max_tokens=1024,
        )

        raw = response.choices[0].message.content.strip()
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

    def _parse_action(self, raw: str) -> dict:
        """Parse and validate the LLM's JSON action response."""
        # Strip markdown fences
        cleaned = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
        cleaned = re.sub(r"\s*```\s*$", "", cleaned, flags=re.MULTILINE)
        cleaned = cleaned.strip()

        try:
            action = json.loads(cleaned)
        except json.JSONDecodeError:
            # Try to extract JSON from within text
            match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', cleaned)
            if match:
                action = json.loads(match.group())
            else:
                raise ValueError(f"Could not parse JSON from LLM: {raw[:200]}")

        action_type = action.get("action", "")
        if action_type not in VALID_ACTIONS:
            raise ValueError(
                f"Unknown action '{action_type}'. Valid: {sorted(VALID_ACTIONS)}"
            )

        return action
