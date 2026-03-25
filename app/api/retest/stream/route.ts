import { NextRequest } from 'next/server';

/**
 * SSE proxy for the Python Retest Engine streaming endpoint.
 * Pipes Server-Sent Events from the engine through to the browser.
 */

const ENGINE_BASE = process.env.RETEST_ENGINE_URL || 'http://127.0.0.1:5555';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(`${ENGINE_BASE}/retest/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(300_000),
    });

    if (!res.ok) {
      const errorData = await res.text();
      return new Response(errorData, { status: res.status });
    }

    if (!res.body) {
      return new Response('No response body from engine', { status: 502 });
    }

    // Pipe the SSE stream through
    return new Response(res.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: `Retest engine unreachable: ${err.message}` }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export const maxDuration = 300;
