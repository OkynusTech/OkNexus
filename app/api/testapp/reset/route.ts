import { NextResponse } from 'next/server';
import { SESSIONS, COMMENTS } from '../health/route';

export async function POST() {
  // Clear mutable arrays/objects
  Object.keys(SESSIONS).forEach(k => delete SESSIONS[k]);
  COMMENTS.splice(0, COMMENTS.length);
  return NextResponse.json({ message: 'State reset' });
}
