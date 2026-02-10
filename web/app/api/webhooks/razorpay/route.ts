import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature, mapSubscriptionStatus } from '@/lib/razorpay'

const GCP_API_URL = process.env.GCP_API_URL || 'http://localhost:3000'
const GCP_API_SECRET = process.env.GCP_API_SECRET || ''

// Notify GCP backend about subscription status change
async function notifyGCP(data: {
  userId: string
  subscriptionStatus: string
  plan?: string
  currentPeriodEnd?: string
  nextBillingDate?: string
  paymentId?: string
  paymentAmount?: number
  action?: 'start' | 'stop' | 'upgrade'
}) {
  try {
    const response = await fetch(`${GCP_API_URL}/subscriptions/update-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': GCP_API_SECRET
      },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      console.error('[webhook] Failed to notify GCP:', await response.text())
    }
  } catch (error) {
    console.error('[webhook] Error notifying GCP:', error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-razorpay-signature')

    if (!signature) {
      console.error('[razorpay-webhook] Missing signature header')
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    // Get raw body for signature verification
    const bodyText = await request.text()

    // Verify signature
    const isValid = verifyWebhookSignature(bodyText, signature)

    if (!isValid) {
      console.error('[razorpay-webhook] Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const event = JSON.parse(bodyText)
    const eventType = event.event
    const payload = event.payload

    console.log(`[razorpay-webhook] Received event: ${eventType}`)

    // Handle different event types
    switch (eventType) {
      case 'subscription.authenticated':
        // User authorized recurring payments
        await handleSubscriptionAuthenticated(payload)
        break

      case 'subscription.activated':
        await handleSubscriptionActivated(payload)
        break

      case 'subscription.charged':
        await handleSubscriptionCharged(payload)
        break

      case 'subscription.pending':
        // Payment being processed, no action needed
        break

      case 'subscription.halted':
        await handleSubscriptionHalted(payload)
        break

      case 'subscription.cancelled':
        await handleSubscriptionCancelled(payload)
        break

      case 'subscription.paused':
        await handleSubscriptionPaused(payload)
        break

      case 'subscription.resumed':
        await handleSubscriptionResumed(payload)
        break

      case 'payment.failed':
        await handlePaymentFailed(payload)
        break

      default:
        console.log(`[razorpay-webhook] Unhandled event: ${eventType}`)
    }

    // Always acknowledge receipt
    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('[razorpay-webhook] Error:', error)
    // Still return 200 to prevent Razorpay retries on our errors
    return NextResponse.json({ received: true, error: error.message })
  }
}

async function handleSubscriptionAuthenticated(payload: any) {
  const subscription = payload.subscription?.entity
  if (!subscription) return

  const userId = subscription.notes?.userId
  if (!userId) return

  console.log(`[razorpay-webhook] Subscription authenticated for ${userId}`)
  // Just logging - waiting for activation
}

async function handleSubscriptionActivated(payload: any) {
  const subscription = payload.subscription?.entity
  if (!subscription) return

  const userId = subscription.notes?.userId
  if (!userId) return

  console.log(`[razorpay-webhook] Subscription activated for ${userId}`)

  await notifyGCP({
    userId,
    subscriptionStatus: 'ACTIVE',
    plan: subscription.notes?.plan,
    currentPeriodEnd: subscription.current_end
      ? new Date(subscription.current_end * 1000).toISOString()
      : undefined,
    nextBillingDate: subscription.charge_at
      ? new Date(subscription.charge_at * 1000).toISOString()
      : undefined,
    action: 'start'
  })
}

async function handleSubscriptionCharged(payload: any) {
  const subscription = payload.subscription?.entity
  const payment = payload.payment?.entity
  if (!subscription) return

  const userId = subscription.notes?.userId
  if (!userId) return

  console.log(`[razorpay-webhook] Subscription charged for ${userId}`)

  await notifyGCP({
    userId,
    subscriptionStatus: 'ACTIVE',
    currentPeriodEnd: subscription.current_end
      ? new Date(subscription.current_end * 1000).toISOString()
      : undefined,
    nextBillingDate: subscription.charge_at
      ? new Date(subscription.charge_at * 1000).toISOString()
      : undefined,
    paymentId: payment?.id,
    paymentAmount: payment?.amount
  })
}

async function handleSubscriptionHalted(payload: any) {
  const subscription = payload.subscription?.entity
  if (!subscription) return

  const userId = subscription.notes?.userId
  if (!userId) return

  console.log(`[razorpay-webhook] Subscription halted for ${userId}`)

  await notifyGCP({
    userId,
    subscriptionStatus: 'SUSPENDED',
    action: 'stop'
  })
}

async function handleSubscriptionCancelled(payload: any) {
  const subscription = payload.subscription?.entity
  if (!subscription) return

  const userId = subscription.notes?.userId
  if (!userId) return

  console.log(`[razorpay-webhook] Subscription cancelled for ${userId}`)

  await notifyGCP({
    userId,
    subscriptionStatus: 'CANCELLED',
    action: 'stop'
  })
}

async function handleSubscriptionPaused(payload: any) {
  const subscription = payload.subscription?.entity
  if (!subscription) return

  const userId = subscription.notes?.userId
  if (!userId) return

  console.log(`[razorpay-webhook] Subscription paused for ${userId}`)

  await notifyGCP({
    userId,
    subscriptionStatus: 'SUSPENDED'
  })
}

async function handleSubscriptionResumed(payload: any) {
  const subscription = payload.subscription?.entity
  if (!subscription) return

  const userId = subscription.notes?.userId
  if (!userId) return

  console.log(`[razorpay-webhook] Subscription resumed for ${userId}`)

  await notifyGCP({
    userId,
    subscriptionStatus: 'ACTIVE',
    action: 'start'
  })
}

async function handlePaymentFailed(payload: any) {
  const payment = payload.payment?.entity
  if (!payment) return

  // Need to find user by subscription ID
  // For now, log the failure - the subscription.halted event will handle status
  console.log(`[razorpay-webhook] Payment failed: ${payment.id}`)

  // If we have subscription notes, notify GCP
  const subscriptionId = payment.subscription_id
  if (subscriptionId) {
    // We don't have userId here directly, but subscription.halted will follow
    console.log(`[razorpay-webhook] Payment failed for subscription: ${subscriptionId}`)
  }
}
