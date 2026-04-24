#!/usr/bin/env python3
"""Debug the data leak detection."""

body = '{"id":2,"owner":"bob","email":"bob@example.com"}'
body_lower = body.lower()

_DATA_LEAK_KEYWORDS = [
    "ssn", "social security", "password", "credit card",
    "secret_key", "confidential", "email",
    "phone", "date_of_birth", "owner",
]

print(f"Body: {body}")
print(f"Body lower: {body_lower}")
print(f"Body length: {len(body)}")
print()

for kw in _DATA_LEAK_KEYWORDS:
    pattern1 = f'"{kw}":'
    pattern2 = f"'{kw}':"
    match1 = pattern1 in body_lower
    match2 = pattern2 in body_lower
    print(f'  {kw}: "{pattern1}" in body = {match1}, "{pattern2}" in body = {match2}')

leaked = [
    kw for kw in _DATA_LEAK_KEYWORDS
    if f'"{kw}":' in body_lower or f"'{kw}':" in body_lower
]
print()
print(f"Leaked keywords found: {leaked}")
