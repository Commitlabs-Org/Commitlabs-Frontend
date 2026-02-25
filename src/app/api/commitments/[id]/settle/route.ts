import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { logCommitmentSettled } from '@/lib/backend/logger';

interface Params {
    params: { id: string };
}

export async function POST(req: NextRequest, { params }: Params) {
    const { id } = params;

    // same rate limiting that base endpoint uses
    const ip = req.ip || req.headers.get('x-forwarded-for') || 'anonymous';
    const isAllowed = await checkRateLimit(ip, 'api/commitments/settle');
    if (!isAllowed) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // TODO: perform settlement logic (smart contract, db update, etc.)
    try {
        const body = await req.json();
        logCommitmentSettled({ ip, commitmentId: id, ...body });
    } catch (e) {
        logCommitmentSettled({ ip, commitmentId: id, error: 'failed to parse request body' });
    }

    return NextResponse.json({
        message: `Stub settlement endpoint for commitment ${id}`,
        commitmentId: id
    });
}