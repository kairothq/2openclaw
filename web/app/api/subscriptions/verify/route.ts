import { NextRequest, NextResponse } from 'next/server'
import { verifyPaymentSignature } from '@/lib/razorpay'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = body

    if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
      return NextResponse.json(
        { error: 'Missing payment verification fields', verified: false },
        { status: 400 }
      )
    }

    // Verify signature directly on Vercel (keys are here)
    const isValid = verifyPaymentSignature(
      razorpay_subscription_id,
      razorpay_payment_id,
      razorpay_signature
    )

    if (!isValid) {
      console.error('[subscriptions] Invalid payment signature')
      return NextResponse.json(
        { error: 'Invalid payment signature', verified: false },
        { status: 400 }
      )
    }

    console.log(`[subscriptions] Payment verified: ${razorpay_payment_id}`)

    return NextResponse.json({
      verified: true,
      paymentId: razorpay_payment_id
    })
  } catch (error: any) {
    console.error('Subscription verify error:', error)
    return NextResponse.json(
      { verified: false, error: error.message || 'Verification failed' },
      { status: 500 }
    )
  }
}
