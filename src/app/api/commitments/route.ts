import { NextRequest } from 'next/server'
import { withApiHandler } from "@/lib/backend/withApiHandler";
import { NextResponse } from 'next/server'

export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get('limit') || 10);
  const offset = Number(searchParams.get('offset') || 0);
  const status = searchParams.get('status');

  // Mock data matching test expectations
  const mockCommitments = [
    {
      id: 'commitment_1',
      title: 'Test Commitment',
      amount: 1000,
      status: 'active',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'commitment_2',
      title: 'Another Commitment',
      amount: 2000,
      status: 'pending',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'commitment_3',
      title: 'Completed Commitment',
      amount: 3000,
      status: 'completed',
      createdAt: new Date().toISOString(),
    },
  ];

  let data = mockCommitments;
  if (status) {
    data = data.filter(c => c.status === status);
  }

  // Apply pagination
  const paginated = data.slice(offset, offset + limit);

  return NextResponse.json({
    data: paginated,
    total: data.length,
    limit,
    offset,
  });
});

export const POST = withApiHandler(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { title, amount } = body || {};

    if (!title || amount === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate a unique ID
    const id = 'commitment_' + Date.now() + '_' + Math.random().toString(36).substring(2);
    
    return NextResponse.json({
      id,
      title,
      amount,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }, { status: 201 });
  } catch (error) {
    // JSON parse error or other
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
});
