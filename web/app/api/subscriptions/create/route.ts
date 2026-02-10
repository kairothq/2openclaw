import { NextRequest, NextResponse } from 'next/server'
import { createCustomer, createSubscription, PlanId } from '@/lib/razorpay'

const GCP_API_URL = process.env.GCP_API_URL || 'http://localhost:3000'
const GCP_API_SECRET = process.env.GCP_API_SECRET || ''

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, email, planId, name } = body

    if (!userId || !email || !planId) {
      return NextResponse.json(
        { error: 'userId, email, and planId are required' },
        { status: 400 }
      )
    }

    if (!['starter', 'pro', 'business'].includes(planId)) {
      return NextResponse.json(
        { error: 'Invalid plan' },
        { status: 400 }
      )
    }

    // Create Razorpay customer (directly from Vercel)
    const customer = await createCustomer(email, name)
    console.log(`[subscriptions] Created customer: ${customer.id}`)

    // Create subscription (directly from Vercel)
    const subscription = await createSubscription(customer.id, planId as PlanId, { userId })
    console.log(`[subscriptions] Created subscription: ${subscription.id}`)

    // Update user data on GCP with subscription info
    await fetch(`${GCP_API_URL}/subscriptions/update-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': GCP_API_SECRET
      },
      body: JSON.stringify({
        userId,
        email,
        razorpayCustomerId: customer.id,
        razorpaySubscriptionId: subscription.id,
        subscriptionStatus: 'PENDING',
        plan: planId
      })
    })

    return NextResponse.json({
      success: true,
      subscriptionId: subscription.id,
      shortUrl: subscription.short_url,
      status: subscription.status
    })
  } catch (error: any) {
    console.error('Subscription create error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create subscription' },
      { status: 500 }
    )
  }
}
