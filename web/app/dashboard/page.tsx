'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

interface InstanceData {
  userId: string
  status: string
  startedAt: string
  subdomain: string
  url: string
  plan: string
  botUsername?: string
}

interface SubscriptionData {
  plan: string
  subscriptionStatus: string
  trialEndsAt?: string
  daysRemaining?: number
  nextBillingDate?: string
  shortUrl?: string
}

const PLAN_NAMES: Record<string, string> = {
  free: 'Free Trial',
  starter: 'Starter',
  pro: 'Pro',
  business: 'Business'
}

const PLAN_PRICES: Record<string, string> = {
  starter: '199',
  pro: '499',
  business: '1,499'
}

function DashboardContent() {
  const searchParams = useSearchParams()
  const [instance, setInstance] = useState<InstanceData | null>(null)
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [stats, setStats] = useState<{ cpu: string; memory: string } | null>(null)
  const [logs, setLogs] = useState<string>('')
  const [logsOpen, setLogsOpen] = useState(false)
  const [logsLoading, setLogsLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState('')
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [selectedUpgradePlan, setSelectedUpgradePlan] = useState('')
  const [upgrading, setUpgrading] = useState(false)

  useEffect(() => {
    const urlUserId = searchParams.get('id')
    const storedData = localStorage.getItem('startclaw_instance')

    let userId = urlUserId
    let botUsername = ''

    if (storedData) {
      const parsed = JSON.parse(storedData)
      if (!userId) userId = parsed.userId
      botUsername = parsed.botUsername || ''
    }

    if (!userId) {
      setError('No instance found. Please deploy first.')
      setLoading(false)
      return
    }

    fetchInstance(userId, botUsername)
    fetchSubscription(userId)
  }, [searchParams])

  const fetchInstance = async (userId: string, botUsername: string) => {
    try {
      const res = await fetch(`/api/instance/${userId}`)
      const data = await res.json()

      if (data.error) {
        setError(data.error)
      } else {
        setInstance({ ...data, botUsername })
        fetchStats(userId)
      }
    } catch (e) {
      setError('Failed to fetch instance')
    } finally {
      setLoading(false)
    }
  }

  const fetchSubscription = async (userId: string) => {
    try {
      const res = await fetch(`/api/subscriptions/${userId}`)
      const data = await res.json()
      if (!data.error) {
        setSubscription(data)
      }
    } catch {}
  }

  const fetchStats = async (userId: string) => {
    try {
      const res = await fetch(`/api/instance/${userId}/stats`)
      const data = await res.json()
      if (!data.error) {
        setStats(data)
      }
    } catch {}
  }

  const fetchLogs = async () => {
    if (!instance) return
    setLogsLoading(true)
    try {
      const res = await fetch(`/api/instance/${instance.userId}/logs?lines=200`)
      const data = await res.json()
      if (data.logs) {
        setLogs(data.logs)
      } else {
        setLogs(data.error || 'Failed to fetch logs')
      }
    } catch {
      setLogs('Failed to fetch logs')
    } finally {
      setLogsLoading(false)
    }
  }

  const performAction = async (action: 'restart' | 'stop' | 'start') => {
    if (!instance) return
    setActionLoading(action)

    try {
      const res = await fetch(`/api/instance/${instance.userId}/${action}`, {
        method: 'POST'
      })
      const data = await res.json()

      if (data.success) {
        setTimeout(() => fetchInstance(instance.userId, instance.botUsername || ''), 1000)
      } else {
        alert(data.error || 'Action failed')
      }
    } catch (e) {
      alert('Action failed')
    } finally {
      setActionLoading('')
    }
  }

  const handleUpgrade = async () => {
    if (!instance || !selectedUpgradePlan) return
    setUpgrading(true)

    try {
      // For upgrade, we redirect to payment
      window.location.href = `/onboard?plan=${selectedUpgradePlan}&upgrade=true`
    } catch (e) {
      alert('Failed to start upgrade')
    } finally {
      setUpgrading(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl text-center py-20">
        <div className="text-5xl mb-4 animate-pulse">🦞</div>
        <p className="text-gray-400">Loading your instance...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl text-center py-20">
        <div className="text-5xl mb-4">😕</div>
        <h1 className="text-2xl font-bold mb-4">Oops!</h1>
        <p className="text-gray-400 mb-8">{error}</p>
        <a
          href="/onboard"
          className="inline-block bg-lobster-500 px-8 py-3 rounded-lg font-semibold hover:bg-lobster-400 transition-colors"
        >
          Deploy New Instance →
        </a>
      </div>
    )
  }

  if (!instance) return null

  const isRunning = instance.status === 'running'
  const isTrial = subscription?.subscriptionStatus === 'TRIAL' || instance.plan === 'free'
  const isPastDue = subscription?.subscriptionStatus === 'PAST_DUE'
  const isSuspended = subscription?.subscriptionStatus === 'SUSPENDED'

  return (
    <div className="mx-auto max-w-4xl">
      {/* Alert Banners */}
      {isPastDue && (
        <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg px-4 py-3 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-yellow-400">⚠️</span>
            <span className="text-yellow-300">Payment failed. Please update your payment method to avoid service interruption.</span>
          </div>
          <a
            href={subscription?.shortUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-yellow-500 text-black px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-yellow-400"
          >
            Update Payment
          </a>
        </div>
      )}

      {isSuspended && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg px-4 py-3 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-red-400">🚫</span>
            <span className="text-red-300">Your subscription is suspended. Reactivate to restore service.</span>
          </div>
          <button
            onClick={() => setShowUpgradeModal(true)}
            className="bg-red-500 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-red-400"
          >
            Reactivate
          </button>
        </div>
      )}

      {isTrial && subscription?.daysRemaining !== undefined && subscription.daysRemaining <= 3 && (
        <div className="bg-lobster-500/10 border border-lobster-500/50 rounded-lg px-4 py-3 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lobster-400">⏰</span>
            <span className="text-lobster-300">
              {subscription.daysRemaining === 0
                ? 'Your trial expires today!'
                : `Your trial expires in ${subscription.daysRemaining} day${subscription.daysRemaining === 1 ? '' : 's'}.`}
            </span>
          </div>
          <button
            onClick={() => setShowUpgradeModal(true)}
            className="bg-lobster-500 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-lobster-400"
          >
            Upgrade Now
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-gray-400">Manage your OpenClaw instance</p>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${
          isRunning ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        }`}>
          <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-400' : 'bg-red-400'}`} />
          {instance.status}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Subscription Status */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold mb-4">Subscription</h2>
          <dl className="space-y-4">
            <div className="flex justify-between items-center">
              <dt className="text-gray-400">Plan</dt>
              <dd className="flex items-center gap-2">
                <span className="font-semibold">{PLAN_NAMES[subscription?.plan || instance.plan] || 'Free Trial'}</span>
                {isTrial && (
                  <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-0.5 rounded-full">Trial</span>
                )}
              </dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-gray-400">Status</dt>
              <dd>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  subscription?.subscriptionStatus === 'ACTIVE' ? 'bg-green-500/20 text-green-400' :
                  subscription?.subscriptionStatus === 'TRIAL' ? 'bg-blue-500/20 text-blue-400' :
                  subscription?.subscriptionStatus === 'PAST_DUE' ? 'bg-yellow-500/20 text-yellow-400' :
                  subscription?.subscriptionStatus === 'SUSPENDED' ? 'bg-red-500/20 text-red-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {subscription?.subscriptionStatus || 'TRIAL'}
                </span>
              </dd>
            </div>
            {isTrial && subscription?.daysRemaining !== undefined && (
              <div className="flex justify-between items-center">
                <dt className="text-gray-400">Trial Ends</dt>
                <dd>{subscription.daysRemaining} days remaining</dd>
              </div>
            )}
            {subscription?.nextBillingDate && !isTrial && (
              <div className="flex justify-between items-center">
                <dt className="text-gray-400">Next Billing</dt>
                <dd>{new Date(subscription.nextBillingDate).toLocaleDateString()}</dd>
              </div>
            )}
          </dl>
          {(isTrial || instance.plan === 'starter') && (
            <button
              onClick={() => setShowUpgradeModal(true)}
              className="w-full mt-4 bg-lobster-500 hover:bg-lobster-400 px-4 py-2.5 rounded-lg font-semibold transition-colors"
            >
              Upgrade Plan
            </button>
          )}
        </div>

        {/* Instance Info */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold mb-4">Instance Info</h2>
          <dl className="space-y-4">
            {instance.botUsername && (
              <div>
                <dt className="text-sm text-gray-400">Telegram Bot</dt>
                <dd className="font-mono">
                  <a
                    href={`https://t.me/${instance.botUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    @{instance.botUsername}
                  </a>
                </dd>
              </div>
            )}
            <div>
              <dt className="text-sm text-gray-400">Instance ID</dt>
              <dd className="font-mono text-sm">{instance.userId}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-400">URL</dt>
              <dd className="font-mono text-sm break-all">
                <a href={instance.url} target="_blank" rel="noopener noreferrer" className="text-lobster-400 hover:underline">
                  {instance.subdomain}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-400">Started</dt>
              <dd>{new Date(instance.startedAt).toLocaleString()}</dd>
            </div>
          </dl>
        </div>

        {/* Quick Actions */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            {instance.botUsername && (
              <a
                href={`https://t.me/${instance.botUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between w-full bg-blue-500 hover:bg-blue-400 px-4 py-3 rounded-lg transition-colors"
              >
                <span className="font-semibold">Open Telegram</span>
                <span>→</span>
              </a>
            )}
            <button
              onClick={() => performAction('restart')}
              disabled={!!actionLoading}
              className="flex items-center justify-between w-full bg-gray-800 hover:bg-gray-700 px-4 py-3 rounded-lg transition-colors disabled:opacity-50"
            >
              <span>Restart Instance</span>
              {actionLoading === 'restart' ? (
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <span>🔄</span>
              )}
            </button>
            {isRunning ? (
              <button
                onClick={() => performAction('stop')}
                disabled={!!actionLoading}
                className="flex items-center justify-between w-full bg-gray-800 hover:bg-gray-700 px-4 py-3 rounded-lg transition-colors disabled:opacity-50"
              >
                <span>Stop Instance</span>
                {actionLoading === 'stop' ? (
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <span>⏹</span>
                )}
              </button>
            ) : (
              <button
                onClick={() => performAction('start')}
                disabled={!!actionLoading}
                className="flex items-center justify-between w-full bg-green-600 hover:bg-green-500 px-4 py-3 rounded-lg transition-colors disabled:opacity-50"
              >
                <span>Start Instance</span>
                {actionLoading === 'start' ? (
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <span>▶️</span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Resource Usage */}
        {stats && (
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            <h2 className="text-lg font-semibold mb-4">Resource Usage</h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">CPU</span>
                  <span>{stats.cpu}</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-lobster-500 rounded-full"
                    style={{ width: stats.cpu }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Memory</span>
                  <span>{stats.memory}</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: '40%' }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Logs Viewer */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Instance Logs</h2>
            <div className="flex gap-2">
              <button
                onClick={fetchLogs}
                disabled={logsLoading}
                className="text-sm bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {logsLoading ? 'Loading...' : 'Refresh'}
              </button>
              <button
                onClick={() => {
                  setLogsOpen(!logsOpen)
                  if (!logsOpen && !logs) fetchLogs()
                }}
                className="text-sm bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                {logsOpen ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          {logsOpen && (
            <pre className="bg-black rounded-lg p-4 text-xs text-green-400 font-mono overflow-auto max-h-96 whitespace-pre-wrap">
              {logs || 'Click "Refresh" to load logs...'}
            </pre>
          )}
        </div>

        {/* Help */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold mb-4">Need Help?</h2>
          <div className="space-y-3 text-sm">
            <a href="https://docs.openclaw.ai" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
              <span>📚</span> Documentation
            </a>
            <a href="https://discord.com/invite/clawd" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
              <span>💬</span> Discord Community
            </a>
            <a href="https://github.com/openclaw/openclaw" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
              <span>🐙</span> GitHub
            </a>
          </div>
        </div>
      </div>

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-lg w-full border border-gray-800">
            <h2 className="text-2xl font-bold mb-6">Upgrade Your Plan</h2>

            <div className="space-y-3 mb-6">
              {['starter', 'pro', 'business'].map((planId) => {
                const isCurrentPlan = (subscription?.plan || instance.plan) === planId
                const isDowngrade = (subscription?.plan === 'pro' && planId === 'starter') ||
                                   (subscription?.plan === 'business' && ['starter', 'pro'].includes(planId))

                if (isDowngrade || isCurrentPlan) return null

                return (
                  <button
                    key={planId}
                    onClick={() => setSelectedUpgradePlan(planId)}
                    disabled={isCurrentPlan}
                    className={`w-full text-left p-4 rounded-xl border ${
                      selectedUpgradePlan === planId
                        ? 'border-lobster-500 bg-lobster-500/10'
                        : 'border-gray-700 hover:border-gray-600'
                    } transition-colors ${isCurrentPlan ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{PLAN_NAMES[planId]}</div>
                        <div className="text-sm text-gray-400">
                          {planId === 'starter' && '1.5GB RAM, Priority Support'}
                          {planId === 'pro' && '3GB RAM, Priority Support, Custom Prompts'}
                          {planId === 'business' && '4GB RAM, Custom Domain, Priority Support'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold">₹{PLAN_PRICES[planId]}</div>
                        <div className="text-sm text-gray-400">/month</div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="flex-1 px-4 py-3 rounded-lg border border-gray-700 hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpgrade}
                disabled={!selectedUpgradePlan || upgrading}
                className="flex-1 bg-lobster-500 hover:bg-lobster-400 px-4 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50"
              >
                {upgrading ? 'Processing...' : 'Upgrade Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  return (
    <main className="min-h-screen py-12 px-6">
      <Suspense fallback={
        <div className="mx-auto max-w-4xl text-center py-20">
          <div className="text-5xl mb-4 animate-pulse">🦞</div>
          <p className="text-gray-400">Loading...</p>
        </div>
      }>
        <DashboardContent />
      </Suspense>
    </main>
  )
}
