import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// Environment variables (set in Vercel)
const GCP_API_URL = process.env.GCP_API_URL || 'http://localhost:3000'
const GCP_API_SECRET = process.env.GCP_API_SECRET || ''

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { telegramToken, telegramUserId, aiProvider, apiKey, plan, email } = body
    
    if (!telegramToken) {
      return NextResponse.json({ error: 'Telegram token required' }, { status: 400 })
    }
    
    if (!telegramUserId) {
      return NextResponse.json({ error: 'Telegram user ID required' }, { status: 400 })
    }
    
    // Generate unique user ID
    const userId = crypto.randomBytes(8).toString('hex')
    
    // Call GCP provisioning API
    const response = await fetch(`${GCP_API_URL}/provision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': GCP_API_SECRET
      },
      body: JSON.stringify({
        userId,
        telegramToken,
        ownerIds: [telegramUserId],
        aiProvider: aiProvider || 'gemini',
        apiKey,
        plan: plan || 'free',
        email
      })
    })
    
    const data = await response.json()
    
    if (response.ok && data.success) {
      // TODO: Save user to database
      // TODO: Send welcome email
      
      return NextResponse.json({
        success: true,
        userId: data.userId,
        subdomain: data.subdomain,
        url: data.url
      })
    } else {
      return NextResponse.json({ 
        success: false, 
        error: data.error || 'Provisioning failed' 
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Provision error:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
