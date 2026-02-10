import { NextRequest, NextResponse } from 'next/server'

const GCP_API_URL = process.env.GCP_API_URL || 'http://localhost:3000'
const GCP_API_SECRET = process.env.GCP_API_SECRET || ''

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    const response = await fetch(`${GCP_API_URL}/subscriptions/${userId}`, {
      headers: {
        'X-API-Key': GCP_API_SECRET
      }
    })

    const data = await response.json()

    if (response.ok) {
      return NextResponse.json(data)
    } else {
      return NextResponse.json(
        { error: data.error || 'Failed to get subscription' },
        { status: response.status }
      )
    }
  } catch (error) {
    console.error('Subscription get error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
