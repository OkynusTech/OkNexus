import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy for the Python Retest Engine.
 * Keeps the engine URL server-side (env var) so we can swap localhost 
 * for a Render/Railway URL without rebuilding the frontend.
 *
 * Next.js frontend POSTs to /api/retest, this forwards to the engine.
 */

const ENGINE_BASE = process.env.RETEST_ENGINE_URL || 'http://127.0.0.1:5555';

export async function GET() {
  try {
    const res = await fetch(`${ENGINE_BASE}/health`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: `Cannot reach retest engine at ${ENGINE_BASE}` },
      { status: 502 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(`${ENGINE_BASE}/retest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      // Retests can take a while — give the engine up to 5 minutes
      signal: AbortSignal.timeout(300_000),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Retest engine unreachable: ${err.message}` },
      { status: 502 }
    );
  }
}

export const maxDuration = 300; // Vercel / Render: allow 5-min function runtime
