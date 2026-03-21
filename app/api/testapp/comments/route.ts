import { NextRequest, NextResponse } from 'next/server';
import { COMMENTS, resolveUser } from '../health/route';

export async function GET() {
  return NextResponse.json(COMMENTS);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { text } = body;
  if (!text) return NextResponse.json({ error: 'text is required' }, { status: 400 });

  const current = resolveUser(req);
  const author = current ? current.name : 'Anonymous';

  // ⚠️ VULNERABILITY: text is stored raw with zero sanitization (Stored XSS)
  const comment = { author, text };
  COMMENTS.push(comment);

  return NextResponse.json({ message: 'Comment posted', comment });
}
