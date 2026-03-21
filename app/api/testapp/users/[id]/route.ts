import { NextRequest, NextResponse } from 'next/server';
import { USERS, resolveUser } from '../../health/route';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const current = resolveUser(req);
  if (!current) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = parseInt(params.id, 10);
  const target = USERS[userId];
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // ⚠️ VULNERABILITY: No ownership check — user 2 can read user 1's profile including SSN
  return NextResponse.json(target);
}
