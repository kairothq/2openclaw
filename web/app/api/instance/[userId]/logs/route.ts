import { NextRequest, NextResponse } from 'next/server'

const GCP_API_URL = process.env.GCP_API_URL || 'http://localhost:3000'
const GCP_API_SECRET = process.env.GCP_API_SECRET || ''

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  const lines = request.nextUrl.searchParams.get('lines') || '100'

  try {
    const response = await fetch(`${GCP_API_URL}/instances/${userId}/logs?lines=${lines}`, {
      headers: {
        'X-API-Key': GCP_API_SECRET
      }
    })

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 })
  }
}
