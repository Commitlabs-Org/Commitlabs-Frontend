import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, COOKIE_OPTIONS, revokeSession } from '@/lib/backend/auth';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (token) {
    revokeSession(token);
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(AUTH_COOKIE_NAME, '', { ...COOKIE_OPTIONS, maxAge: 0 });
  return res;
}
