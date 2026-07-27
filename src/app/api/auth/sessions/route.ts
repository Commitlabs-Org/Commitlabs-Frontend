import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, listOtherSessions } from '@/lib/backend/auth';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json(
      { error: 'Authorization header required' },
      { status: 401 },
    );
  }

  const session = verifySessionToken(token);
  if (!session.valid) {
    return NextResponse.json(
      { error: 'Invalid or expired session token' },
      { status: 401 },
    );
  }

  const sessions = listOtherSessions(token);

  return NextResponse.json({ sessions });
}
