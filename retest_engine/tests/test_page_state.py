from retest_engine.page_state import PageState, focused_state_to_text


def _sample_state() -> PageState:
    return PageState(
        url="http://localhost/test",
        title="Test",
        visible_text="Login page visible",
        form_fields=[{"name": "username", "selector": "#username"}],
        buttons=[{"text": "Login", "selector": "#login-btn"}],
        links=[{"text": "Home", "href": "/"}],
        cookies=[{"name": "session_token", "value": "abc", "domain": "localhost"}],
        dom_summary="forms:1 inputs:2 buttons:1 links:1 iframes:0",
        last_network_response={"status": 200, "url": "http://localhost/api", "body_snippet": "{}"},
    )


def test_focused_authenticate_contains_form_context() -> None:
    text = focused_state_to_text(_sample_state(), "AUTHENTICATE")
    assert "FORM_FIELDS" in text
    assert "BUTTONS" in text
    assert "COOKIES" in text


def test_focused_access_resource_omits_form_noise() -> None:
    text = focused_state_to_text(_sample_state(), "ACCESS_RESOURCE")
    assert "LAST_RESPONSE" in text
    assert "FORM_FIELDS" not in text
    assert "BUTTONS" not in text


def test_focused_verdict_includes_dom_summary() -> None:
    text = focused_state_to_text(_sample_state(), "VERDICT")
    assert "DOM_SUMMARY" in text