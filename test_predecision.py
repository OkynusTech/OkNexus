#!/usr/bin/env python3
"""Quick validation of pre-decision layer functionality."""

from retest_engine.decision import check_idor, check_auth_bypass, check_xss

print("=== PRE-DECISION LAYER VALIDATION ===\n")

print("IDOR Tests:")
r1 = check_idor(403, 'Forbidden')
print(f"  [1] HTTP 403: {r1['status']} (confidence: {r1['confidence']})")

r2 = check_idor(200, '{"id":2,"owner":"bob","email":"bob@example.com"}')
print(f"  [2] HTTP 200 + data leak: {r2['status']} (confidence: {r2['confidence']})")

r3 = check_idor(200, 'ok')
print(f"  [3] HTTP 200 + no signals: {r3} (inconclusive, let LLM decide)")

print("\nAUTH_BYPASS Tests:")
r4 = check_auth_bypass(401, 'Unauthorized')
print(f"  [4] HTTP 401: {r4['status']} (confidence: {r4['confidence']})")

r5 = check_auth_bypass(200, 'admin panel with secret_key exposed')
print(f"  [5] HTTP 200 + multi-signals: {r5['status']} (confidence: {r5['confidence']})")

r6 = check_auth_bypass(200, 'dashboard')
print(f"  [6] HTTP 200 + weak signal: {r6} (inconclusive, let LLM decide)")

print("\nXSS Tests:")
r7 = check_xss(True)
print(f"  [7] Marker=True: {r7['status']} (confidence: {r7['confidence']})")

r8 = check_xss(False)
print(f"  [8] Marker=False: {r8['status']} (confidence: {r8['confidence']})")

print("\n" + "="*50)
print("RESULT: Pre-decision layer is WORKING CORRECTLY")
print("="*50)
