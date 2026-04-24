"""
State Machine for the Agentic Retester.

This module provides "rails" for the LLM. Instead of telling the agent
to solve the entire vulnerability at once, we break it into rigid stages.
The agent must complete one stage before moving to the next.
"""

from typing import List


_ALL_ACTIONS = {
    "navigate", "fill", "click", "api_request",
    "evaluate_js", "wait", "verdict",
    "extract_form_tokens", "check_redirect",
    "next_stage",
}

_STAGE_ALLOWED_ACTIONS = {
    "AUTHENTICATE": {
        "navigate", "fill", "click", "wait", "evaluate_js",
        "api_request", "extract_form_tokens", "next_stage",
    },
    "ACCESS_RESOURCE": {"navigate", "api_request", "wait", "evaluate_js", "next_stage"},
    "INJECT_PAYLOAD": {"navigate", "fill", "click", "wait", "next_stage"},
    "CHECK_REFLECTION": {"navigate", "evaluate_js", "click", "wait", "next_stage"},
    "ACCESS_RESTRICTED": {"navigate", "api_request", "click", "wait", "evaluate_js", "next_stage"},
    "TRIGGER_REDIRECT": {"check_redirect", "navigate", "click", "wait", "next_stage"},
    "INJECT_SQL": {"api_request", "navigate", "fill", "click", "wait", "next_stage"},
    "TEST_VULNERABILITY": _ALL_ACTIONS - {"verdict"},
    "VERDICT": {"verdict"},
}

class Stage:
    def __init__(self, name: str, instruction: str):
        self.name = name
        self.instruction = instruction


class RetestFSM:
    def __init__(self, vuln_type: str):
        self.vuln_type = vuln_type.upper()
        self.stages = self._build_stages(self.vuln_type)
        self.current_idx = 0

    def current_stage(self) -> Stage:
        """Returns the current stage the agent is in."""
        if self.current_idx < len(self.stages):
            return self.stages[self.current_idx]
        return self.stages[-1]

    def advance(self) -> bool:
        """Move to the next stage. Returns True if advanced, False if already at the end."""
        if self.current_idx < len(self.stages) - 1:
            self.current_idx += 1
            return True
        return False

    def is_finished(self) -> bool:
        return self.current_stage().name == "VERDICT"

    def allowed_actions_for_current_stage(self) -> set[str]:
        """Return the allowed action set for the current stage."""
        stage_name = self.current_stage().name
        return _STAGE_ALLOWED_ACTIONS.get(stage_name, _ALL_ACTIONS)

    def is_action_allowed(self, action: str) -> bool:
        """Return True if action is allowed in the current stage."""
        return action in self.allowed_actions_for_current_stage()

    def _build_stages(self, vuln_type: str) -> List[Stage]:
        stages = []
        
        # Most vulns require authentication first if credentials exist.
        if vuln_type in ("IDOR", "AUTH_BYPASS", "SQLI", "CSRF", "STORED_XSS", "REFLECTED_XSS"):
            stages.append(
                Stage("AUTHENTICATE", 
                      "Navigate to the target application and log in using the provided credentials. "
                      "Only move to the next stage once you believe you are logged in.")
            )

        if vuln_type == "IDOR":
            stages.append(
                Stage("ACCESS_RESOURCE", 
                      "Use an api_request to access the protected resource using a DIFFERENT user's ID "
                      "than your own.")
            )
            stages.append(
                Stage("VERDICT", 
                      "Analyze the HTTP response and issue your final verdict.")
            )
            
        elif vuln_type == "STORED_XSS":
            stages.append(
                Stage("INJECT_PAYLOAD", 
                      "Navigate to the vulnerable form (e.g. comment box, profile), "
                      "fill the XSS payload into the field, and submit the form.")
            )
            stages.append(
                Stage("CHECK_REFLECTION", 
                      "Navigate to the page where the payload is reflected. Use evaluate_js "
                      "to check if `window['__xss_oknexus']` equals 1.")
            )
            stages.append(
                Stage("VERDICT", "Issue a final verdict based on the marker execution.")
            )
            
        elif vuln_type == "REFLECTED_XSS":
            stages.append(
                Stage("INJECT_PAYLOAD", 
                      "Navigate to the vulnerable URL with the XSS payload injected into the vulnerable parameter.")
            )
            stages.append(
                Stage("VERDICT", "Use evaluate_js to check the marker and issue a final verdict.")
            )
            
        elif vuln_type == "AUTH_BYPASS":
            stages.append(
                Stage("ACCESS_RESTRICTED", 
                      "Attempt to access the restricted admin or privileged endpoint.")
            )
            stages.append(
                Stage("VERDICT", "Issue a final verdict based on whether you bypassed access controls.")
            )
            
        elif vuln_type == "OPEN_REDIRECT":
            stages.append(
                Stage("TRIGGER_REDIRECT", 
                      "Navigate to the vulnerable URL with a redirect parameter pointing to an external domain (e.g., https://evil.example.com).")
            )
            stages.append(
                Stage("VERDICT", "Issue a final verdict based on the final loaded URL.")
            )
            
        elif vuln_type == "SQLI":
            stages.append(
                Stage("INJECT_SQL", 
                      "Send api_requests with the SQL injection payloads to the target endpoint.")
            )
            stages.append(
                Stage("VERDICT", "Issue a final verdict based on database errors or leaked data in the response.")
            )
            
        else:
            # Fallback for unknown types
            stages.append(
                Stage("TEST_VULNERABILITY", 
                      f"Test the {vuln_type} vulnerability using appropriate actions.")
            )
            stages.append(Stage("VERDICT", "Issue a final verdict."))

        return stages
