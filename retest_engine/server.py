"""
Simple Flask HTTP server for the retest_engine.

Run with:
    python -m flask --app retest_engine.server run --port 5555

Or directly:
    python retest_engine/server.py

Then POST to: http://localhost:5555/retest

Example:
    curl -X POST http://localhost:5555/retest \\
      -H "Content-Type: application/json" \\
      -d '{
        "retest_id": "test_001",
        "vulnerability_type": "IDOR",
        "target_url": "https://app.example.com",
        "steps_to_reproduce": "Login as user 123, access /api/users/124/profile",
        "credentials": {"username": "alice", "password": "secret"}
      }'
"""

import json
import logging
import threading
import traceback
from datetime import datetime

import dotenv
dotenv.load_dotenv(dotenv.find_dotenv(".env.local"))

from flask import Flask, request, jsonify, Response

from .main import run_retest
from .event_stream import EventBus
from .orchestrator import run as _async_run
from .logger import get_logger

# ── Flask Setup ───────────────────────────────────────────────────────────────
app = Flask(__name__)
app.config['JSON_SORT_KEYS'] = False
log = get_logger("server")

# Suppress Flask's verbose default logging
logging.getLogger('werkzeug').setLevel(logging.WARNING)


# ── CORS ─────────────────────────────────────────────────────────────────────
# Allow the Next.js frontend (localhost:3000) to call the engine directly.

@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    return response


@app.route('/retest', methods=['OPTIONS'])
@app.route('/retest/stream', methods=['OPTIONS'])
@app.route('/health', methods=['OPTIONS'])
@app.route('/info', methods=['OPTIONS'])
def cors_preflight():
    return '', 204


# ── Health check ──────────────────────────────────────────────────────────────

@app.route('/health', methods=['GET'])
def health():
    """Simple health check endpoint."""
    return jsonify({
        "status": "healthy",
        "service": "retest_engine",
        "timestamp": datetime.utcnow().isoformat(),
    }), 200


# ── Main retest endpoint ──────────────────────────────────────────────────────

@app.route('/retest', methods=['POST'])
def submit_retest():
    """
    Accept a retest request and run it synchronously.

    Request body:
    {
        "retest_id": "string",
        "vulnerability_type": "IDOR" | "STORED_XSS",
        "target_url": "string",
        "steps_to_reproduce": "string",
        "credentials": {
            "username": "string",
            "password": "string"
        }
    }

    Response:
    {
        "retest_id": "string",
        "status": "verified" | "not_fixed" | "failed",
        "evidence": {
            "screenshots": list,
            "logs": list,
            "network_data": list,
            "details": dict
        },
        "error": "string (only if status=failed)"
    }
    """
    try:
        # ── Parse request ─────────────────────────────────────────────────────
        if not request.is_json:
            return jsonify({
                "error": "Content-Type must be application/json"
            }), 400

        payload = request.get_json()
        log.info(f"Retest request received: {payload.get('retest_id')}")

        # ── Validate required fields ──────────────────────────────────────────
        required = ["retest_id", "vulnerability_type", "target_url", "credentials"]
        missing = [f for f in required if not payload.get(f)]
        if missing:
            return jsonify({
                "error": f"Missing required fields: {', '.join(missing)}"
            }), 400

        if not isinstance(payload.get("credentials"), dict):
            return jsonify({"error": "credentials must be a dict"}), 400

        # ── Run retest ────────────────────────────────────────────────────────
        log.info(f"Running retest: {payload['retest_id']}")
        result = run_retest(payload)

        log.info(
            f"Retest completed: {payload['retest_id']} -> {result['status']}"
        )

        return jsonify(result), 200

    except Exception as exc:
        log.error(f"Unhandled exception:\n{traceback.format_exc()}")
        return jsonify({
            "error": f"Internal server error: {str(exc)}",
            "trace": traceback.format_exc()
        }), 500


# ── SSE streaming endpoint ────────────────────────────────────────────────────

@app.route('/retest/stream', methods=['POST'])
def submit_retest_stream():
    """
    Same as /retest but returns Server-Sent Events for real-time progress.

    Events emitted:
      - turn_start:  {"turn": N, "max_turns": M}
      - turn_action: {"turn": N, "action": "...", "reasoning": "..."}
      - turn_result: {"turn": N, "result": "..."}
      - verdict:     {"status": "...", "confidence": N, "summary": "..."}
      - complete:    {full result object}
      - error:       {"message": "..."}
    """
    try:
        if not request.is_json:
            return jsonify({"error": "Content-Type must be application/json"}), 400

        payload = request.get_json()
        log.info(f"SSE retest request received: {payload.get('retest_id')}")

        required = ["retest_id", "vulnerability_type", "target_url", "credentials"]
        missing = [f for f in required if not payload.get(f)]
        if missing:
            return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400

        if not isinstance(payload.get("credentials"), dict):
            return jsonify({"error": "credentials must be a dict"}), 400

        event_bus = EventBus()
        subscriber = event_bus.subscribe()

        import asyncio

        # Run orchestrator in a background thread
        result_holder = {"result": None, "error": None}

        def _run_in_thread():
            try:
                result_holder["result"] = asyncio.run(
                    _async_run(payload, event_bus=event_bus)
                )
            except Exception as exc:
                result_holder["error"] = str(exc)
                event_bus.emit("error", {"message": str(exc)})

        thread = threading.Thread(target=_run_in_thread, daemon=True)
        thread.start()

        def generate_events():
            import queue
            try:
                while thread.is_alive() or not subscriber.empty():
                    try:
                        event = subscriber.get(timeout=1.0)
                    except queue.Empty:
                        continue
                    
                    try:
                        yield event_bus.format_sse(event)
                    except Exception as format_exc:
                        log.error(f"Failed to format SSE event: {format_exc}")
                        yield event_bus.format_sse({
                            "type": "error",
                            "data": {"message": f"SSE Serialization Error: {format_exc}"}
                        })
                        
                    if event.get("type") == "complete" or event.get("type") == "error":
                        break

                # If thread died with error and no complete/error event was sent
                if result_holder["error"] and not result_holder["result"]:
                    yield event_bus.format_sse({
                        "type": "error",
                        "data": {"message": result_holder["error"]},
                    })
            finally:
                event_bus.unsubscribe(subscriber)

        return Response(
            generate_events(),
            mimetype='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'X-Accel-Buffering': 'no',
            },
        )

    except Exception as exc:
        log.error(f"SSE endpoint error:\n{traceback.format_exc()}")
        return jsonify({"error": f"Internal server error: {str(exc)}"}), 500


# ── Info endpoint ─────────────────────────────────────────────────────────────

@app.route('/info', methods=['GET'])
def info():
    """Returns service metadata."""
    return jsonify({
        "service": "retest_engine",
        "version": "1.0",
        "endpoints": {
            "POST /retest": "Submit a retest request",
            "GET /health": "Health check",
            "GET /info": "This endpoint",
        },
        "supported_vulnerabilities": [
            "IDOR", "STORED_XSS", "AUTH_BYPASS", "CSRF",
            "OPEN_REDIRECT", "REFLECTED_XSS", "SQLI",
        ],
    }), 200


# ── Error handlers ────────────────────────────────────────────────────────────

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404


@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify({"error": "Method not allowed"}), 405


# ── Entrypoint ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    log.info("Starting retest_engine server on http://localhost:5555")
    log.info("Health check: GET http://localhost:5555/health")
    log.info("Submit retest: POST http://localhost:5555/retest")
    app.run(host="0.0.0.0", port=5555, debug=False, use_reloader=False)
