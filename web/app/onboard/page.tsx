'use client'

import { useState, Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

type Step = 'email' | 'telegram' | 'token' | 'userid' | 'ai' | 'plan' | 'payment' | 'deploy' | 'done'

const STEPS = ['email', 'telegram', 'token', 'userid', 'ai', 'plan', 'payment', 'done']

const PLANS = [
  { id: 'free', name: 'Free Trial', price: '₹0', period: '7 days', features: ['1.5GB RAM', 'BYOK (Your API Key)', 'Test your bot'] },
  { id: 'starter', name: 'Starter', price: '₹199', period: '/month', features: ['1.5GB RAM', 'BYOK (Your API Key)', 'Email Support'], popular: false },
  { id: 'pro', name: 'Pro', price: '₹499', period: '/month', features: ['3GB RAM', 'BYOK (Your API Key)', 'Priority Support'], popular: true },
  { id: 'business', name: 'Business', price: '₹1,499', period: '/month', features: ['4GB RAM', 'BYOK (Your API Key)', 'Priority Support'] }
]

declare global {
  interface Window {
    Razorpay: any
  }
}

function OnboardContent() {
  const searchParams = useSearchParams()
  const initialPlan = searchParams.get('plan') || 'free'

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [telegramToken, setTelegramToken] = useState('')
  const [telegramUserId, setTelegramUserId] = useState('')
  const [aiProvider, setAiProvider] = useState('gemini')
  const [apiKey, setApiKey] = useState('')
  const [selectedPlan, setSelectedPlan] = useState(initialPlan)
  const [isValidating, setIsValidating] = useState(false)
  const [isDeploying, setIsDeploying] = useState(false)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ userId: string; subdomain: string; url: string } | null>(null)
  const [botInfo, setBotInfo] = useState<{ username: string } | null>(null)
  const [userId, setUserId] = useState('')

  // Load Razorpay script
  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    document.body.appendChild(script)
    return () => {
      document.body.removeChild(script)
    }
  }, [])

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const validateToken = async () => {
    setIsValidating(true)
    setError('')

    try {
      const res = await fetch('/api/validate-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: telegramToken })
      })

      const data = await res.json()

      if (data.valid) {
        setBotInfo(data.bot)
        setStep('userid')
      } else {
        setError(data.error || 'Invalid token')
      }
    } catch (e) {
      setError('Failed to validate token')
    } finally {
      setIsValidating(false)
    }
  }

  const handlePlanContinue = async () => {
    // All plans now go through payment for card/UPI auth
    // Free trial = deferred billing (no charge for 7 days)
    setStep('payment')
  }

  const initiatePayment = async () => {
    setIsProcessingPayment(true)
    setError('')

    try {
      // First, provision the instance (creates user record)
      const provisionRes = await fetch('/api/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramToken,
          telegramUserId,
          aiProvider,
          apiKey,
          email,
          plan: selectedPlan
        })
      })

      const provisionData = await provisionRes.json()

      if (!provisionData.success) {
        setError(provisionData.error || 'Failed to create instance')
        setIsProcessingPayment(false)
        return
      }

      setUserId(provisionData.userId)

      // Create subscription
      // For free trial: pass trial=true for deferred billing (7 days)
      const isTrial = selectedPlan === 'free'
      const subRes = await fetch('/api/subscriptions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: provisionData.userId,
          email,
          planId: isTrial ? 'starter' : selectedPlan, // Free trial uses starter plan
          name: email.split('@')[0],
          trial: isTrial
        })
      })

      const subData = await subRes.json()

      if (!subData.success) {
        setError(subData.error || 'Failed to create subscription')
        setIsProcessingPayment(false)
        return
      }

      // Open Razorpay Checkout
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        subscription_id: subData.subscriptionId,
        name: '2OpenClaw',
        description: `${PLANS.find(p => p.id === selectedPlan)?.name} Plan`,
        image: '/logo.png',
        handler: async function (response: any) {
          // Verify payment
          const verifyRes = await fetch('/api/subscriptions/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_signature: response.razorpay_signature
            })
          })

          const verifyData = await verifyRes.json()

          if (verifyData.verified) {
            // Save to localStorage
            localStorage.setItem('startclaw_instance', JSON.stringify({
              userId: provisionData.userId,
              botUsername: botInfo?.username,
              subdomain: provisionData.subdomain,
              url: provisionData.url
            }))
            setResult(provisionData)
            setStep('done')
          } else {
            setError('Payment verification failed. Please contact support.')
          }
          setIsProcessingPayment(false)
        },
        prefill: {
          email: email
        },
        theme: {
          color: '#f97316'
        },
        modal: {
          ondismiss: function() {
            setIsProcessingPayment(false)
            setError('Payment was cancelled. You can try again.')
          }
        }
      }

      const razorpay = new window.Razorpay(options)
      razorpay.open()
    } catch (e) {
      console.error('Payment error:', e)
      setError('Failed to process payment. Please try again.')
      setIsProcessingPayment(false)
    }
  }

  const deploy = async () => {
    setIsDeploying(true)
    setError('')

    try {
      const res = await fetch('/api/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramToken,
          telegramUserId,
          aiProvider,
          apiKey,
          email,
          plan: 'free'
        })
      })

      const data = await res.json()

      if (data.success) {
        localStorage.setItem('startclaw_instance', JSON.stringify({
          userId: data.userId,
          botUsername: botInfo?.username,
          subdomain: data.subdomain,
          url: data.url
        }))
        setResult(data)
        setStep('done')
      } else {
        setError(data.error || 'Deployment failed')
      }
    } catch (e) {
      setError('Failed to deploy')
    } finally {
      setIsDeploying(false)
    }
  }

  const currentStepIndex = STEPS.indexOf(step)
  // All plans now go through payment (free trial uses deferred billing)
  const isPaidPlan = true

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="text-5xl mb-4">🦞</div>
        <h1 className="text-3xl font-bold">Deploy Your AI Assistant</h1>
        <p className="text-gray-400 mt-2">
          {selectedPlan === 'free' ? '7-day free trial' : `${PLANS.find(p => p.id === selectedPlan)?.name} Plan`}
        </p>
      </div>

      {/* Progress */}
      <div className="flex items-center justify-center gap-1 mb-12 overflow-x-auto">
        {STEPS.filter(s => isPaidPlan || s !== 'payment').map((s, i) => (
          <div key={s} className="flex items-center">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
              step === s ? 'bg-lobster-500' :
              currentStepIndex > STEPS.indexOf(s) ? 'bg-green-500' : 'bg-gray-800'
            }`}>
              {currentStepIndex > STEPS.indexOf(s) ? '✓' : i + 1}
            </div>
            {i < (isPaidPlan ? STEPS.length - 1 : STEPS.length - 2) && <div className="w-6 h-0.5 bg-gray-800" />}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">

        {/* Step 1: Email */}
        {step === 'email' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Step 1: Your Email</h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-lobster-500"
                />
                <p className="text-sm text-gray-500 mt-2">
                  We'll send deployment updates and payment receipts here
                </p>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg px-4 py-3 text-red-400">
                  {error}
                </div>
              )}

              <button
                onClick={() => {
                  if (!validateEmail(email)) {
                    setError('Please enter a valid email address')
                    return
                  }
                  setError('')
                  setStep('telegram')
                }}
                disabled={!email}
                className="w-full bg-lobster-500 py-3 rounded-lg font-semibold hover:bg-lobster-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Create Telegram Bot */}
        {step === 'telegram' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Step 2: Create Telegram Bot</h2>

            <div className="space-y-6">
              <div className="bg-gray-800 rounded-xl p-6">
                <h3 className="font-semibold mb-4">Follow these steps:</h3>
                <ol className="space-y-4 text-gray-300">
                  <li className="flex gap-3">
                    <span className="bg-lobster-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm flex-shrink-0">1</span>
                    <span>Open Telegram and search for <code className="bg-gray-700 px-2 py-0.5 rounded">@BotFather</code></span>
                  </li>
                  <li className="flex gap-3">
                    <span className="bg-lobster-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm flex-shrink-0">2</span>
                    <span>Send the command <code className="bg-gray-700 px-2 py-0.5 rounded">/newbot</code></span>
                  </li>
                  <li className="flex gap-3">
                    <span className="bg-lobster-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm flex-shrink-0">3</span>
                    <span>Choose a name for your bot (e.g., "My AI Assistant")</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="bg-lobster-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm flex-shrink-0">4</span>
                    <span>Choose a username ending in <code className="bg-gray-700 px-2 py-0.5 rounded">_bot</code></span>
                  </li>
                  <li className="flex gap-3">
                    <span className="bg-lobster-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm flex-shrink-0">5</span>
                    <span>Copy the <strong>API token</strong> BotFather gives you</span>
                  </li>
                </ol>
              </div>

              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-blue-500 text-white py-3 rounded-lg text-center font-semibold hover:bg-blue-400 transition-colors"
              >
                Open @BotFather →
              </a>

              <div className="flex gap-4">
                <button
                  onClick={() => setStep('email')}
                  className="px-6 py-3 rounded-lg border border-gray-700 hover:bg-gray-800 transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setStep('token')}
                  className="flex-1 bg-lobster-500 py-3 rounded-lg font-semibold hover:bg-lobster-400 transition-colors"
                >
                  I have my token →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Enter Token */}
        {step === 'token' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Step 3: Enter Your Bot Token</h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Telegram Bot Token
                </label>
                <input
                  type="text"
                  value={telegramToken}
                  onChange={(e) => setTelegramToken(e.target.value)}
                  placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-lobster-500"
                />
                <p className="text-sm text-gray-500 mt-2">
                  Paste the token you received from @BotFather
                </p>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg px-4 py-3 text-red-400">
                  {error}
                </div>
              )}

              <div className="flex gap-4">
                <button
                  onClick={() => setStep('telegram')}
                  className="px-6 py-3 rounded-lg border border-gray-700 hover:bg-gray-800 transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={validateToken}
                  disabled={!telegramToken || isValidating}
                  className="flex-1 bg-lobster-500 py-3 rounded-lg font-semibold hover:bg-lobster-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isValidating ? 'Validating...' : 'Validate Token →'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Your Telegram ID */}
        {step === 'userid' && (
          <div>
            <h2 className="text-2xl font-bold mb-2">Step 4: Your Telegram ID</h2>
            {botInfo && (
              <p className="text-green-400 mb-6">✓ Bot validated: @{botInfo.username}</p>
            )}

            <div className="space-y-6">
              <div className="bg-gray-800 rounded-xl p-6">
                <h3 className="font-semibold mb-4">How to get your Telegram ID:</h3>
                <ol className="space-y-4 text-gray-300">
                  <li className="flex gap-3">
                    <span className="bg-lobster-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm flex-shrink-0">1</span>
                    <span>Open Telegram and message <code className="bg-gray-700 px-2 py-0.5 rounded">@userinfobot</code></span>
                  </li>
                  <li className="flex gap-3">
                    <span className="bg-lobster-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm flex-shrink-0">2</span>
                    <span>It will reply with your user ID (a number like <code className="bg-gray-700 px-2 py-0.5 rounded">123456789</code>)</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="bg-lobster-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm flex-shrink-0">3</span>
                    <span>Copy and paste that number below</span>
                  </li>
                </ol>
              </div>

              <a
                href="https://t.me/userinfobot"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-blue-500 text-white py-3 rounded-lg text-center font-semibold hover:bg-blue-400 transition-colors"
              >
                Open @userinfobot →
              </a>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Your Telegram User ID
                </label>
                <input
                  type="text"
                  value={telegramUserId}
                  onChange={(e) => setTelegramUserId(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456789"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-lobster-500"
                />
                <p className="text-sm text-gray-500 mt-2">
                  This ensures only YOU can chat with your bot
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setStep('token')}
                  className="px-6 py-3 rounded-lg border border-gray-700 hover:bg-gray-800 transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setStep('ai')}
                  disabled={!telegramUserId}
                  className="flex-1 bg-lobster-500 py-3 rounded-lg font-semibold hover:bg-lobster-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Choose AI */}
        {step === 'ai' && (
          <div>
            <h2 className="text-2xl font-bold mb-2">Step 5: Choose Your AI</h2>
            {botInfo && (
              <p className="text-green-400 mb-6">✓ Bot validated: @{botInfo.username}</p>
            )}

            <div className="space-y-6">
              <div className="space-y-3">
                {[
                  { id: 'gemini', name: 'Google Gemini', desc: 'Gemini 2.0 Flash — Fast & affordable', recommended: true },
                  { id: 'openai', name: 'OpenAI', desc: 'GPT-4o — Most popular choice' },
                  { id: 'anthropic', name: 'Anthropic', desc: 'Claude — Best for reasoning & code' }
                ].map((provider) => (
                  <button
                    key={provider.id}
                    onClick={() => setAiProvider(provider.id)}
                    className={`w-full text-left p-4 rounded-xl border ${
                      aiProvider === provider.id
                        ? 'border-lobster-500 bg-lobster-500/10'
                        : 'border-gray-700 hover:border-gray-600'
                    } transition-colors`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{provider.name}</div>
                        <div className="text-sm text-gray-400">{provider.desc}</div>
                      </div>
                      {provider.recommended && (
                        <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-full">
                          Recommended
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* Gemini instructions */}
              {aiProvider === 'gemini' && (
                <div className="bg-gray-800 rounded-xl p-6">
                  <h3 className="font-semibold mb-4">Get your Gemini API key:</h3>
                  <ol className="space-y-3 text-gray-300 text-sm">
                    <li className="flex gap-3">
                      <span className="bg-lobster-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0">1</span>
                      <span>Go to <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-lobster-400 underline">aistudio.google.com/apikey</a></span>
                    </li>
                    <li className="flex gap-3">
                      <span className="bg-lobster-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0">2</span>
                      <span>Sign in with Google and click "Create API key"</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="bg-lobster-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0">3</span>
                      <span>Copy the key and paste below</span>
                    </li>
                  </ol>
                  <p className="text-xs text-gray-500 mt-4">
                    Free tier: 1,500 requests/day. Paid: ~$0.50/1M tokens
                  </p>
                </div>
              )}

              {/* OpenAI instructions */}
              {aiProvider === 'openai' && (
                <div className="bg-gray-800 rounded-xl p-6">
                  <h3 className="font-semibold mb-4">Get your OpenAI API key:</h3>
                  <ol className="space-y-3 text-gray-300 text-sm">
                    <li className="flex gap-3">
                      <span className="bg-lobster-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0">1</span>
                      <span>Go to <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-lobster-400 underline">platform.openai.com/api-keys</a></span>
                    </li>
                    <li className="flex gap-3">
                      <span className="bg-lobster-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0">2</span>
                      <span>Sign in and click "Create new secret key"</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="bg-lobster-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0">3</span>
                      <span>Copy the key (starts with sk-)</span>
                    </li>
                  </ol>
                  <p className="text-xs text-gray-500 mt-4">
                    Pricing: ~$5/1M input tokens, ~$15/1M output tokens (GPT-4o)
                  </p>
                </div>
              )}

              {/* Anthropic instructions */}
              {aiProvider === 'anthropic' && (
                <div className="bg-gray-800 rounded-xl p-6">
                  <h3 className="font-semibold mb-4">Get your Anthropic API key:</h3>
                  <ol className="space-y-3 text-gray-300 text-sm">
                    <li className="flex gap-3">
                      <span className="bg-lobster-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0">1</span>
                      <span>Go to <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-lobster-400 underline">console.anthropic.com/settings/keys</a></span>
                    </li>
                    <li className="flex gap-3">
                      <span className="bg-lobster-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0">2</span>
                      <span>Sign in and click "Create Key"</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="bg-lobster-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0">3</span>
                      <span>Copy the key (starts with sk-ant-)</span>
                    </li>
                  </ol>
                  <p className="text-xs text-gray-500 mt-4">
                    Pricing: ~$3/1M input, ~$15/1M output (Claude Sonnet)
                  </p>
                </div>
              )}

              {/* API Key input - BYOK required */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  {aiProvider === 'gemini' ? 'Google Gemini' :
                   aiProvider === 'anthropic' ? 'Anthropic' : 'OpenAI'} API Key
                  <span className="text-lobster-400 ml-1">*</span>
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    aiProvider === 'gemini' ? 'AIza...' :
                    aiProvider === 'anthropic' ? 'sk-ant-...' : 'sk-...'
                  }
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-lobster-500"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Your key is stored securely and used only for your bot. You pay the provider directly.
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setStep('userid')}
                  className="px-6 py-3 rounded-lg border border-gray-700 hover:bg-gray-800 transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setStep('plan')}
                  disabled={!apiKey}
                  className="flex-1 bg-lobster-500 py-3 rounded-lg font-semibold hover:bg-lobster-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 6: Choose Plan */}
        {step === 'plan' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Step 6: Choose Your Plan</h2>

            <div className="space-y-6">
              <div className="grid gap-4">
                {PLANS.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan.id)}
                    className={`w-full text-left p-4 rounded-xl border ${
                      selectedPlan === plan.id
                        ? 'border-lobster-500 bg-lobster-500/10'
                        : 'border-gray-700 hover:border-gray-600'
                    } transition-colors relative`}
                  >
                    {plan.popular && (
                      <span className="absolute -top-2 right-4 bg-lobster-500 text-white text-xs px-2 py-0.5 rounded-full">
                        Most Popular
                      </span>
                    )}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-lg">{plan.name}</div>
                        <div className="text-sm text-gray-400 mt-1">
                          {plan.features.join(' • ')}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold">{plan.price}</div>
                        <div className="text-sm text-gray-400">{plan.period}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg px-4 py-3 text-red-400">
                  {error}
                </div>
              )}

              <div className="flex gap-4">
                <button
                  onClick={() => setStep('ai')}
                  className="px-6 py-3 rounded-lg border border-gray-700 hover:bg-gray-800 transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={handlePlanContinue}
                  className="flex-1 bg-lobster-500 py-3 rounded-lg font-semibold hover:bg-lobster-400 transition-colors"
                >
                  {selectedPlan === 'free' ? 'Continue to Verify Payment →' : 'Continue to Payment →'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 7: Payment (for all plans - free trial uses deferred billing) */}
        {step === 'payment' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">
              {selectedPlan === 'free' ? 'Step 7: Verify Payment Method' : 'Step 7: Complete Payment'}
            </h2>

            <div className="space-y-6">
              {/* Free trial info banner */}
              {selectedPlan === 'free' && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-sm text-green-300">
                  <p className="font-semibold mb-1">7-Day Free Trial</p>
                  <p>We'll verify your payment method but won't charge you today. After 7 days, you'll be charged ₹199/month (Starter plan). Cancel anytime.</p>
                </div>
              )}

              <div className="bg-gray-800 rounded-xl p-6">
                <h3 className="font-semibold mb-4">Order Summary</h3>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-400">Plan</dt>
                    <dd className="font-semibold">
                      {selectedPlan === 'free' ? '7-Day Free Trial → Starter' : PLANS.find(p => p.id === selectedPlan)?.name}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-400">Telegram Bot</dt>
                    <dd>@{botInfo?.username}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-400">Email</dt>
                    <dd>{email}</dd>
                  </div>
                  <div className="border-t border-gray-700 pt-3 mt-3">
                    {selectedPlan === 'free' ? (
                      <>
                        <div className="flex justify-between text-lg">
                          <dt className="font-semibold">Today</dt>
                          <dd className="font-bold text-green-400">₹0</dd>
                        </div>
                        <div className="flex justify-between text-sm text-gray-400 mt-1">
                          <dt>After 7 days</dt>
                          <dd>₹199/month</dd>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between text-lg">
                        <dt className="font-semibold">Total</dt>
                        <dd className="font-bold text-lobster-400">
                          {PLANS.find(p => p.id === selectedPlan)?.price}/month
                        </dd>
                      </div>
                    )}
                  </div>
                </dl>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-sm text-blue-300">
                <p>Your subscription will auto-renew monthly. Cancel anytime from your dashboard.</p>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg px-4 py-3 text-red-400">
                  {error}
                </div>
              )}

              <div className="flex gap-4">
                <button
                  onClick={() => setStep('plan')}
                  disabled={isProcessingPayment}
                  className="px-6 py-3 rounded-lg border border-gray-700 hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  ← Back
                </button>
                <button
                  onClick={initiatePayment}
                  disabled={isProcessingPayment}
                  className="flex-1 bg-lobster-500 py-3 rounded-lg font-semibold hover:bg-lobster-400 transition-colors disabled:opacity-50"
                >
                  {isProcessingPayment ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Processing...
                    </span>
                  ) : selectedPlan === 'free' ? (
                    'Start Free Trial →'
                  ) : (
                    'Pay with Razorpay →'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 8: Deploy (for free plan) */}
        {step === 'deploy' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Step 7: Deploy Your Assistant</h2>

            <div className="space-y-6">
              <div className="bg-gray-800 rounded-xl p-6">
                <h3 className="font-semibold mb-4">Summary</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-400">Email</dt>
                    <dd>{email}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-400">Telegram Bot</dt>
                    <dd>@{botInfo?.username}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-400">AI Provider</dt>
                    <dd>{aiProvider === 'gemini' ? 'Google Gemini' :
                         aiProvider === 'anthropic' ? 'Anthropic Claude' :
                         'OpenAI GPT'} (BYOK)</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-400">Plan</dt>
                    <dd>7-day Free Trial</dd>
                  </div>
                </dl>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg px-4 py-3 text-red-400">
                  {error}
                </div>
              )}

              <div className="flex gap-4">
                <button
                  onClick={() => setStep('plan')}
                  className="px-6 py-3 rounded-lg border border-gray-700 hover:bg-gray-800 transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={deploy}
                  disabled={isDeploying}
                  className="flex-1 bg-lobster-500 py-3 rounded-lg font-semibold hover:bg-lobster-400 transition-colors disabled:opacity-50"
                >
                  {isDeploying ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Deploying...
                    </span>
                  ) : (
                    'Start Free Trial →'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Done */}
        {step === 'done' && result && (
          <div className="text-center">
            <div className="text-6xl mb-6">🎉</div>
            <h2 className="text-2xl font-bold mb-2">You're Live!</h2>
            <p className="text-gray-400 mb-8">Your AI assistant is ready to chat.</p>

            <div className="bg-gray-800 rounded-xl p-6 mb-8">
              <p className="text-sm text-gray-400 mb-2">Open Telegram and message:</p>
              <p className="text-xl font-mono">@{botInfo?.username}</p>
            </div>

            <div className="space-y-4">
              <a
                href={`https://t.me/${botInfo?.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-blue-500 py-3 rounded-lg font-semibold hover:bg-blue-400 transition-colors"
              >
                Open in Telegram →
              </a>
              <a
                href={`/dashboard?id=${result.userId}`}
                className="block w-full bg-gray-800 py-3 rounded-lg font-semibold hover:bg-gray-700 transition-colors"
              >
                Go to Dashboard
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Onboard() {
  return (
    <main className="min-h-screen py-12 px-6">
      <Suspense fallback={
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-5xl mb-4">🦞</div>
          <p className="text-gray-400">Loading...</p>
        </div>
      }>
        <OnboardContent />
      </Suspense>
    </main>
  )
}
