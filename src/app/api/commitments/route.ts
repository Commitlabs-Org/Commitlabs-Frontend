import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'


interface CommitmentData {
  id: string
  title: string
  amount: number
  status: string
  createdAt: string
}

export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || 'active'
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Mock data - in production, this would call Soroban contracts
    const mockCommitments: CommitmentData[] = [
      {
        id: '1',
        title: 'Liquidity Commitment - USDC',
        amount: 10000,
        status: 'active',
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        title: 'Liquidity Commitment - EUR',
        amount: 5000,
        status: 'active',
        createdAt: new Date().toISOString(),
      },
    ]

    // Filter by status
    const filteredCommitments = mockCommitments.filter(
      (c) => c.status === status
    )

    // Apply pagination
    const paginatedCommitments = filteredCommitments.slice(
      offset,
      offset + limit
    )

    return NextResponse.json(
      {
        data: paginatedCommitments,
        total: filteredCommitments.length,
        limit,
        offset,
      },
      { status: 200 }
    )
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to fetch commitments',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.title || !body.amount) {
      return NextResponse.json(
        { error: 'Missing required fields: title, amount' },
        { status: 400 }
      )
    }

    // Mock Soroban contract interaction
    // In production, this would invoke the actual contract
    const newCommitment: CommitmentData = {
      id: randomUUID(),
      title: body.title,
      amount: body.amount,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }

    return NextResponse.json(newCommitment, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to create commitment',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
