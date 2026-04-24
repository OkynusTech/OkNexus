from retest_engine.decision import check_auth_bypass, check_idor


def test_idor_verified_on_access_denied_status() -> None:
    verdict = check_idor(403, "Forbidden")
    assert verdict is not None
    assert verdict["status"] == "verified"


def test_idor_not_fixed_on_data_leak_fields() -> None:
    body = '{"id":2,"owner":"bob","email":"bob@example.com"}'
    verdict = check_idor(200, body)
    assert verdict is not None
    assert verdict["status"] == "not_fixed"


def test_idor_inconclusive_for_small_200_without_signals() -> None:
    verdict = check_idor(200, "ok")
    assert verdict is None


def test_auth_bypass_verified_on_denied_status() -> None:
    verdict = check_auth_bypass(401, "Unauthorized")
    assert verdict is not None
    assert verdict["status"] == "verified"


def test_auth_bypass_not_fixed_on_strong_privileged_signals() -> None:
    body = "admin panel with secret_key exposed to standard user"
    verdict = check_auth_bypass(200, body)
    assert verdict is not None
    assert verdict["status"] == "not_fixed"


def test_auth_bypass_inconclusive_on_weak_200_signal() -> None:
    verdict = check_auth_bypass(200, "dashboard")
    assert verdict is None