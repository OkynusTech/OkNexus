from retest_engine.state_machine import RetestFSM


def test_authenticate_stage_blocks_verdict() -> None:
    fsm = RetestFSM("IDOR")
    assert fsm.current_stage().name == "AUTHENTICATE"
    assert not fsm.is_action_allowed("verdict")
    assert fsm.is_action_allowed("fill")


def test_verdict_stage_only_allows_verdict() -> None:
    fsm = RetestFSM("OPEN_REDIRECT")
    assert fsm.current_stage().name == "TRIGGER_REDIRECT"
    assert fsm.advance()
    assert fsm.current_stage().name == "VERDICT"
    assert fsm.is_action_allowed("verdict")
    assert not fsm.is_action_allowed("navigate")


def test_redirect_stage_allows_check_redirect() -> None:
    fsm = RetestFSM("OPEN_REDIRECT")
    assert fsm.current_stage().name == "TRIGGER_REDIRECT"
    assert fsm.is_action_allowed("check_redirect")