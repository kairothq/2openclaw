/**
 * Razorpay Integration Service (Vercel-only)
 * All payment processing happens here - keys never touch GCP
 */

import Razorpay from 'razorpay'
import crypto from 'crypto'

// Lazy initialization to avoid build-time errors
let razorpayInstance: Razorpay | null = null

function getRazorpay(): Razorpay {
  if (!razorpayInstance) {
    const keyId = process.env.RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET

    console.log(`[razorpay] Initializing with key: ${keyId?.substring(0, 15)}...`)

    if (!keyId || !keySecret) {
      throw new Error('Razorpay credentials not configured')
    }
    razorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret
    })
  }
  return razorpayInstance
}

// Plan configuration
export const PLANS = {
  starter: {
    name: '2OpenClaw Starter',
    amount: 19900, // ₹199 in paise
    description: '1.5GB RAM, Priority Support'
  },
  pro: {
    name: '2OpenClaw Pro',
    amount: 49900, // ₹499 in paise
    description: '3GB RAM, Priority Support'
  },
  business: {
    name: '2OpenClaw Business',
    amount: 149900, // ₹1499 in paise
    description: '4GB RAM, Custom Domain, Priority Support'
  }
} as const

export type PlanId = keyof typeof PLANS

/**
 * Create subscription plans in Razorpay (run once during setup)
 */
export async function createPlans() {
  const createdPlans: Record<string, string> = {}

  for (const [planId, config] of Object.entries(PLANS)) {
    try {
      const plan = await getRazorpay().plans.create({
        period: 'monthly',
        interval: 1,
        item: {
          name: config.name,
          amount: config.amount,
          currency: 'INR',
          description: config.description
        }
      })
      createdPlans[planId] = plan.id
      console.log(`Created plan ${planId}: ${plan.id}`)
    } catch (error: any) {
      console.error(`Failed to create plan ${planId}:`, error.message)
      throw error
    }
  }

  return createdPlans
}

export interface RazorpayCustomer {
  id: string
  email: string
  name?: string
  contact?: string
}

/**
 * Create a Razorpay customer
 */
export async function createCustomer(email: string, name?: string, contact?: string): Promise<RazorpayCustomer> {
  try {
    const customer = await getRazorpay().customers.create({
      email,
      name: name || email.split('@')[0],
      contact: contact || undefined,
      fail_existing: 0 // Return existing customer if email matches
    }) as unknown as RazorpayCustomer
    return customer
  } catch (error: any) {
    console.error('[razorpay] Failed to create customer:', error?.error?.description || error?.message || JSON.stringify(error))
    throw error
  }
}

export interface RazorpaySubscription {
  id: string
  plan_id: string
  customer_id: string
  status: string
  current_start?: number
  current_end?: number
  charge_at?: number
  short_url?: string
  notes?: Record<string, string>
}

/**
 * Create a subscription
 */
export async function createSubscription(
  customerId: string,
  planId: PlanId,
  options: { userId?: string } = {}
): Promise<RazorpaySubscription> {
  const planRazorpayId = process.env[`RAZORPAY_PLAN_${planId.toUpperCase()}`]

  if (!planRazorpayId) {
    throw new Error(`Plan ID not configured for: ${planId}`)
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subscription = await (getRazorpay().subscriptions.create as any)({
      plan_id: planRazorpayId,
      customer_id: customerId,
      total_count: 120, // Max 10 years
      quantity: 1,
      customer_notify: 1,
      notes: {
        userId: options.userId || '',
        plan: planId
      }
    }) as RazorpaySubscription

    return subscription
  } catch (error: any) {
    console.error('[razorpay] Failed to create subscription:', error.message)
    throw error
  }
}

/**
 * Get subscription details
 */
export async function getSubscription(subscriptionId: string) {
  try {
    return await getRazorpay().subscriptions.fetch(subscriptionId)
  } catch (error: any) {
    console.error('[razorpay] Failed to fetch subscription:', error.message)
    throw error
  }
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(subscriptionId: string, cancelAtCycleEnd = true) {
  try {
    return await getRazorpay().subscriptions.cancel(subscriptionId, cancelAtCycleEnd)
  } catch (error: any) {
    console.error('[razorpay] Failed to cancel subscription:', error.message)
    throw error
  }
}

/**
 * Update subscription (change plan)
 */
export async function updateSubscription(subscriptionId: string, newPlanId: PlanId) {
  const planRazorpayId = process.env[`RAZORPAY_PLAN_${newPlanId.toUpperCase()}`]

  if (!planRazorpayId) {
    throw new Error(`Plan ID not configured for: ${newPlanId}`)
  }

  try {
    return await getRazorpay().subscriptions.update(subscriptionId, {
      plan_id: planRazorpayId,
      quantity: 1,
      schedule_change_at: 'now'
    })
  } catch (error: any) {
    console.error('[razorpay] Failed to update subscription:', error.message)
    throw error
  }
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(body: string, signature: string): boolean {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.error('[razorpay] Webhook secret not configured')
    return false
  }

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(body)
    .digest('hex')

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  } catch {
    return false
  }
}

/**
 * Verify payment signature (for checkout callback)
 */
export function verifyPaymentSignature(
  subscriptionId: string,
  paymentId: string,
  signature: string
): boolean {
  const keySecret = process.env.RAZORPAY_KEY_SECRET

  if (!keySecret) {
    return false
  }

  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${subscriptionId}|${paymentId}`)
    .digest('hex')

  return expectedSignature === signature
}

/**
 * Map Razorpay subscription status to internal status
 */
export function mapSubscriptionStatus(razorpayStatus: string): string {
  const statusMap: Record<string, string> = {
    'created': 'PENDING',
    'authenticated': 'PENDING',
    'active': 'ACTIVE',
    'pending': 'PAST_DUE',
    'halted': 'SUSPENDED',
    'cancelled': 'CANCELLED',
    'completed': 'CANCELLED',
    'expired': 'CANCELLED',
    'paused': 'SUSPENDED'
  }

  return statusMap[razorpayStatus] || 'UNKNOWN'
}

/**
 * Get payment details
 */
export async function getPayment(paymentId: string) {
  try {
    return await getRazorpay().payments.fetch(paymentId)
  } catch (error: any) {
    console.error('[razorpay] Failed to fetch payment:', error.message)
    throw error
  }
}

export { getRazorpay }
