import { NextRequest, NextResponse } from 'next/server'
import { createCustomer, createSubscription, PlanId } from '@/lib/razorpay'

const GCP_API_URL = process.env.GCP_API_URL || 'http://localhost:3000'
const GCP_API_SECRET = process.env.GCP_API_SECRET || ''

export async function POST(request: NextRequest) {
  console.log('[subscriptions/create] Request received')

  try {
    const body = await request.json()
    console.log('[subscriptions/create] Body:', JSON.stringify(body))
    const { userId, email, planId, name, trial } = body

    if (!userId || !email || !planId) {
      return NextResponse.json(
        { error: 'userId, email, and planId are required' },
        { status: 400 }
      )
    }

    // For free trial, use starter plan with deferred billing
    const effectivePlanId = trial ? 'starter' : planId

    if (!['starter', 'pro', 'business'].includes(effectivePlanId)) {
      return NextResponse.json(
        { error: 'Invalid plan' },
        { status: 400 }
      )
    }

    // Create Razorpay customer (directly from Vercel)
    console.log('[subscriptions/create] Creating customer...')
    const customer = await createCustomer(email, name)
    console.log(`[subscriptions/create] Customer created: ${customer.id}`)

    // Create subscription (directly from Vercel)
    // If trial=true, defer first charge by 7 days
    const trialDays = trial ? 7 : undefined
    console.log(`[subscriptions/create] Creating subscription with plan: ${effectivePlanId}, trial: ${trial ? '7 days' : 'no'}`)
    const subscription = await createSubscription(customer.id, effectivePlanId as PlanId, { userId, trialDays })
    console.log(`[subscriptions/create] Subscription created: ${subscription.id}`)

    // Update user data on GCP with subscription info
    const subscriptionStatus = trial ? 'TRIAL' : 'PENDING'
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
        subscriptionStatus,
        plan: trial ? 'trial' : planId,
        trialEndsAt: trial ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : undefined
      })
    })

    return NextResponse.json({
      success: true,
      subscriptionId: subscription.id,
      shortUrl: subscription.short_url,
      status: subscription.status,
      isTrial: !!trial,
      trialEndsAt: trial ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : undefined
    })
  } catch (error: any) {
    console.error('Subscription create error:', error)
    // Return detailed error for debugging
    const errorMessage = error?.error?.description || error?.message || 'Failed to create subscription'
    return NextResponse.json(
      { success: false, error: errorMessage, details: error?.error || error?.toString() },
      { status: 500 }
    )
  }
}
