'use client'

import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden px-6 py-24 sm:py-32 lg:px-8">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(45%_40%_at_50%_60%,rgba(249,115,22,0.12),transparent)]" />
        
        <div className="mx-auto max-w-4xl text-center">
          {/* Lobster emoji */}
          <div className="mb-8 text-7xl animate-float">🦞</div>
          
          <h1 className="text-5xl font-bold tracking-tight sm:text-7xl">
            Deploy Your Personal AI
            <br />
            <span className="gradient-text">in 60 Seconds</span>
          </h1>

          <p className="mt-6 text-xl leading-8 text-gray-400">
            OpenClaw is a powerful AI assistant that lives in Telegram.
            <br />
            Normally takes 60+ minutes to self-host. We do it in 60 seconds.
            <br />
            <span className="text-gray-500 text-base">No Docker. No VPS. No terminal commands. No technical BS.</span>
          </p>
          
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link
              href="/onboard"
              className="rounded-full bg-lobster-500 px-8 py-4 text-lg font-semibold text-white shadow-lg hover:bg-lobster-400 transition-all glow"
            >
              Get Your AI in 60 Seconds
            </Link>
            <Link href="#how-it-works" className="text-lg font-semibold leading-6 text-gray-300 hover:text-white">
              See how <span aria-hidden="true">→</span>
            </Link>
          </div>

          <p className="mt-4 text-sm text-gray-500">
            7-day free trial • Free AI included • No credit card required
          </p>
        </div>
      </section>

      {/* Time Comparison */}
      <section className="py-16 px-6 bg-gray-900/50">
        <div className="mx-auto max-w-5xl">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            {/* Manual Setup */}
            <div className="bg-gray-900 rounded-2xl p-8 border border-red-500/30">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-3xl">😫</span>
                <h3 className="text-2xl font-bold text-red-400">Self-Hosting OpenClaw</h3>
              </div>
              <ul className="space-y-3 text-gray-400">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">✗</span>
                  <span>Rent a VPS (₹500-1000/mo)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">✗</span>
                  <span>Learn Docker & SSH</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">✗</span>
                  <span>Configure environment variables</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">✗</span>
                  <span>Set up reverse proxy & SSL</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">✗</span>
                  <span>Debug when it inevitably breaks</span>
                </li>
              </ul>
              <div className="mt-6 pt-6 border-t border-gray-800">
                <p className="text-sm text-gray-500">Total time: <span className="text-red-400 font-bold text-lg">60+ minutes</span></p>
                <p className="text-xs text-gray-600 mt-1">Non-technical? Multiply that by 10.</p>
              </div>
            </div>

            {/* Our Platform */}
            <div className="bg-gradient-to-br from-lobster-500/10 to-orange-500/10 rounded-2xl p-8 border-2 border-lobster-500">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-3xl">🦞</span>
                <h3 className="text-2xl font-bold text-lobster-400">2OpenClaw Platform</h3>
              </div>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Enter your Telegram bot token</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Paste your AI API key</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Click "Deploy"</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span className="text-gray-500 italic">That's it. Seriously.</span>
                </li>
              </ul>
              <div className="mt-6 pt-6 border-t border-lobster-500/30">
                <p className="text-sm text-gray-400">Total time: <span className="text-lobster-400 font-bold text-2xl">60 seconds</span></p>
                <p className="text-xs text-gray-500 mt-1">We handle servers, Docker, backups, updates — everything.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-center mb-4">
            Three Steps. That's It.
          </h2>
          <p className="text-center text-gray-400 mb-16">
            No coding. No servers. No headaches.
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                title: 'Create Telegram Bot',
                description: 'Message @BotFather on Telegram, follow the prompts, get your token. We have a video guide.',
                icon: '🤖'
              },
              {
                step: '2',
                title: 'Connect Your AI',
                description: 'Paste your bot token and AI API key (Gemini/OpenAI/Claude). We configure everything instantly.',
                icon: '🔑'
              },
              {
                step: '3',
                title: 'Chat Away',
                description: 'Your AI is live in Telegram. Send a message and watch the magic happen.',
                icon: '💬'
              }
            ].map((item) => (
              <div key={item.step} className="relative bg-gray-900 rounded-2xl p-8 border border-gray-800 hover:border-lobster-500/50 transition-colors">
                <div className="absolute -top-4 -left-4 w-10 h-10 bg-lobster-500 rounded-full flex items-center justify-center font-bold text-lg">
                  {item.step}
                </div>
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-gray-400">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What It Can Do */}
      <section className="py-24 px-6 bg-gray-900/50">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-center mb-4">
            What Can Your AI Actually Do?
          </h2>
          <p className="text-center text-gray-400 mb-16">
            OpenClaw doesn't just chat. It has tools, memory, and can browse the web.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {/* Work & Productivity */}
            <div>
              <h3 className="text-sm font-semibold text-lobster-400 mb-3 uppercase tracking-wide">Work & Productivity</h3>
              <div className="space-y-2">
                {[
                  '📧 Manage emails & draft replies',
                  '📅 Schedule meetings via calendar',
                  '📊 Analyze spreadsheets & data',
                  '💼 Write business proposals',
                  '📝 Summarize long documents',
                  '🔍 Research competitors',
                  '✅ Create to-do lists & reminders'
                ].map((item) => (
                  <div key={item} className="bg-gray-900 rounded-lg px-3 py-2 text-sm border border-gray-800">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Personal & Life */}
            <div>
              <h3 className="text-sm font-semibold text-orange-400 mb-3 uppercase tracking-wide">Personal & Life</h3>
              <div className="space-y-2">
                {[
                  '✈️ Plan trips & find hotels',
                  '💰 Track expenses & budgets',
                  '🏋️ Create workout plans',
                  '🍳 Suggest recipes from ingredients',
                  '🎬 Recommend movies & shows',
                  '📚 Summarize books & articles',
                  '🎓 Help with homework & learning'
                ].map((item) => (
                  <div key={item} className="bg-gray-900 rounded-lg px-3 py-2 text-sm border border-gray-800">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Technical & Creative */}
            <div>
              <h3 className="text-sm font-semibold text-purple-400 mb-3 uppercase tracking-wide">Technical & Creative</h3>
              <div className="space-y-2">
                {[
                  '💻 Write & debug code',
                  '🌐 Browse web for real-time info',
                  '🎨 Generate content ideas',
                  '📱 Control smart home devices',
                  '⚡ Automate repetitive tasks',
                  '🔧 Troubleshoot tech issues',
                  '🤖 Chain complex workflows'
                ].map((item) => (
                  <div key={item} className="bg-gray-900 rounded-lg px-3 py-2 text-sm border border-gray-800">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="text-center text-gray-500 text-sm">
            + anything else you can think of. OpenClaw is extensible with plugins and can be customized for your needs.
          </p>
        </div>
      </section>

      {/* BYOK Explanation */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-4xl">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-10 border border-gray-700">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-4">
                You Control the Costs. We Just Handle the Hosting.
              </h2>
              <p className="text-gray-400 text-lg">
                Unlike other platforms, you bring your own AI API key.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700">
                <div className="text-3xl mb-3">💸</div>
                <h3 className="text-lg font-semibold mb-2">Other Platforms</h3>
                <ul className="space-y-2 text-gray-400 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">✗</span>
                    <span>Mark up AI costs 3-5x</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">✗</span>
                    <span>Charge per message or token</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">✗</span>
                    <span>Lock you into their AI provider</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">✗</span>
                    <span>Bill adds up fast (₹2000+/mo)</span>
                  </li>
                </ul>
              </div>

              <div className="bg-gradient-to-br from-lobster-500/20 to-orange-500/20 rounded-xl p-6 border border-lobster-500/50">
                <div className="text-3xl mb-3">🦞</div>
                <h3 className="text-lg font-semibold mb-2">2OpenClaw (BYOK)</h3>
                <ul className="space-y-2 text-gray-300 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>You pay AI providers directly (at cost)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Unlimited messages for flat ₹199/mo</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Switch AI providers anytime (Gemini/OpenAI/Claude)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Free trial includes free AI (Groq)</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-8 text-center">
              <p className="text-gray-400 text-sm">
                <span className="font-semibold text-white">Example:</span> Gemini Flash is ₹0.05 per 1M tokens.
                Chat all day for ₹10/month + our ₹199 hosting = <span className="text-lobster-400 font-bold">₹209 total</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-center mb-4">
            Ridiculously Affordable. Built for India.
          </h2>
          <p className="text-center text-gray-400 mb-16">
            ₹199/month = 3 cups of coffee. Unlimited messages. Your own AI.
          </p>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Free */}
            <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">
              <h3 className="text-xl font-semibold">Free Trial</h3>
              <div className="mt-4">
                <span className="text-4xl font-bold">₹0</span>
                <span className="text-gray-400"> / 7 days</span>
              </div>
              <p className="mt-2 text-sm text-gray-500">Test drive with zero commitment</p>
              <ul className="mt-8 space-y-3 text-gray-400">
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Full OpenClaw features
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Free AI included (Groq)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Telegram bot setup
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> No credit card needed
                </li>
              </ul>
              <Link href="/onboard" className="mt-8 block w-full rounded-lg bg-gray-800 py-3 text-center font-semibold hover:bg-gray-700 transition-colors">
                Start Free Trial
              </Link>
            </div>
            
            {/* Starter */}
            <div className="bg-gray-900 rounded-2xl p-8 border-2 border-lobster-500 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-lobster-500 px-3 py-1 rounded-full text-sm font-semibold">
                Most Popular
              </div>
              <h3 className="text-xl font-semibold">Starter</h3>
              <div className="mt-4">
                <span className="text-4xl font-bold">₹199</span>
                <span className="text-gray-400"> / month</span>
              </div>
              <p className="mt-2 text-sm text-lobster-400">₹6.60/day. Less than a samosa.</p>
              <ul className="mt-8 space-y-3 text-gray-300">
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> <strong>BYOK</strong> - Use your AI key
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> 1.5GB RAM container
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Daily auto-backups
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Unlimited messages
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Priority support
                </li>
              </ul>
              <Link href="/onboard?plan=starter" className="mt-8 block w-full rounded-lg bg-lobster-500 py-3 text-center font-semibold hover:bg-lobster-400 transition-colors">
                Start with ₹199/mo
              </Link>
            </div>
            
            {/* Pro */}
            <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">
              <h3 className="text-xl font-semibold">Pro</h3>
              <div className="mt-4">
                <span className="text-4xl font-bold">₹499</span>
                <span className="text-gray-400"> / month</span>
              </div>
              <p className="mt-2 text-sm text-gray-500">For power users & businesses</p>
              <ul className="mt-8 space-y-3 text-gray-400">
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Everything in Starter
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> 3GB RAM (2x resources)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Custom domain support
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> WhatsApp priority support
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> 99.9% uptime SLA
                </li>
              </ul>
              <Link href="/onboard?plan=pro" className="mt-8 block w-full rounded-lg bg-gray-800 py-3 text-center font-semibold hover:bg-gray-700 transition-colors">
                Upgrade to Pro
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-6 bg-gradient-to-br from-lobster-500/10 to-orange-500/10">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-4xl font-bold mb-4">
            Ready to Deploy Your AI?
          </h2>
          <p className="text-xl text-gray-400 mb-8">
            Join users who've ditched complex self-hosting for our 60-second setup.
          </p>
          <Link
            href="/onboard"
            className="inline-block rounded-full bg-lobster-500 px-10 py-4 text-lg font-semibold text-white shadow-lg hover:bg-lobster-400 transition-all glow"
          >
            Start Your Free Trial →
          </Link>
          <p className="mt-4 text-sm text-gray-500">
            No credit card • 7 days free • Free AI included • Deploy in 60 seconds
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-gray-800">
        <div className="mx-auto max-w-5xl flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🦞</span>
            <span className="font-semibold">2OpenClaw</span>
          </div>
          <p className="text-gray-500 text-sm">
            Built with ❤️ • Powered by <a href="https://openclaw.ai" className="text-lobster-500 hover:underline">OpenClaw</a>
          </p>
        </div>
      </footer>
    </main>
  )
}
