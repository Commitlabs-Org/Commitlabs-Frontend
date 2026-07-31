import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const pageParam = searchParams.get('page');
  const pageSizeParam = searchParams.get('pageSize');

  const page = pageParam ? Number(pageParam) : 1;
  const pageSize = pageSizeParam ? Number(pageSizeParam) : 10;

  if (
    !Number.isInteger(page) ||
    !Number.isInteger(pageSize) ||
    page < 1 ||
    pageSize < 1 ||
    pageSize > 100
  ) {
    return NextResponse.json({ error: 'Invalid pagination parameters' }, { status: 400 });
  }

  // Logic to demonstrate the bug (slice(NaN, NaN) -> slice(0, 0) -> empty array)
  const allNotifications = Array.from({ length: 50 }, (_, i) => ({ id: i + 1 }));
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  const paginated = allNotifications.slice(start, end);

  return NextResponse.json({
    data: paginated,
    meta: { page, pageSize, total: allNotifications.length },
  });
}
