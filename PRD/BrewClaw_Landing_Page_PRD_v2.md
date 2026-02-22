# BrewClaw Landing Page PRD - Phase 1 (Final)

**Product:** BrewClaw
**Domain:** brewclaw.com
**Target Audience:** Non-technical consumers
**Status:** Ready for Development
**Version:** 2.0 (Refined)

---

## Global Design Decisions

### Background Pattern
| Section | Background | Notes |
|---------|------------|-------|
| Nav | Transparent → Gaussian blur glass | Always sticky, 40% width centered |
| Chip | Below nav | Same as nav blur |
| Hero | **DARK** (#0A0A0A) | Primary dark section |
| Installation Steps | LIGHT (#FFFFFF) | White background |
| Comparison | LIGHT (#FFFFFF) | White background |
| Features | LIGHT (#FFFFFF) | White background |
| Use Cases Marquee | LIGHT (#FFFFFF) | White background |
| Skills Store | **DARK** (#0A0A0A) | Dark section |
| Batch Counter | LIGHT (#FFFFFF) | White background |
| Pricing | **DARK** (#0A0A0A) | Dark section |
| CTA | **DARK** (#0A0A0A) | Dark section |
| Footer | Different shade | Subtle separation |

### Typography (Final)
| Role | Font | Weight | Size |
|------|------|--------|------|
| Brand (ASCII) | Geist Mono | 400 | 10px (art) |
| Headings | Space Grotesk | 500 | 36px |
| Body | Geist | 400 | 16px |
| Code | Geist Mono | 400 | 14px |

### Color Palette (Espresso Theme)
| Token | Hex | Usage |
|-------|-----|-------|
| Primary Background (Dark) | #0A0A0A | Dark sections |
| Primary Background (Light) | #FFFFFF | Light sections |
| Accent (Espresso) | #78350F | Subtle highlights only |
| Text Primary | #FFFFFF / #1A1A1A | On dark / on light |
| Text Secondary | #999999 / #666666 | Muted text |

**Rule:** Coffee colors on <5% of page area. No emojis. Premium style only.

---

## Section 1: Navigation Bar

### Template Reference
`/v0 templates/New/sticky-nav-pricing/components/navbar.tsx`

### Layout
```
[Logo BREWCLAW]          [Features] [Pricing] [Docs] [FAQs]          [Get Started]
     ↑ Left                        Center (scroll links)                Right ↑
```

### Specifications
| Property | Value |
|----------|-------|
| Position | Fixed, sticky |
| Width | ~40% centered (20% space each side) |
| Background | Transparent with gaussian blur glass effect |
| Effect | Content behind blurs through nav |
| Height | 64px desktop, 56px mobile |

### Elements
| Element | Spec |
|---------|------|
| Logo | BREWCLAW text (logo TBD) |
| Features | Scroll to Section 7 (Use Cases) |
| Pricing | Scroll to Section 10 |
| Docs | Disabled (Phase 2) - "Coming soon" tooltip |
| FAQs | Scroll to FAQ section or disabled |
| CTA Button | "Get Started" → `brewclaw.com/signup` |

### Animation
- Framer Motion entrance: `y: -100, opacity: 0 → y: 0, opacity: 1`
- Hover: Pill background follows hovered item (`layoutId="navbar-hover"`)
- CTA: `shimmer-btn` effect from template

### Acceptance Criteria
- [ ] Logo links to homepage
- [ ] Center links scroll to respective sections
- [ ] Docs shows "Coming soon" tooltip
- [ ] CTA redirects to signup funnel
- [ ] Gaussian blur effect on content behind
- [ ] Mobile: Hamburger menu

---

## Section 2: Rotating Status Chip

### Template Reference
`/v0 templates/New/sticky-nav-pricing/app/globals.css` (pulse-glow animation)

### Position
Below nav, above hero (separate element)

### Rotating Messages
| Order | Message |
|-------|---------|
| 1 | Built on OpenClaw |
| 2 | {X} registered in Batch 3 |
| 3 | {X} seats left |

### Animation
```css
@keyframes pulse-glow {
  0%, 100% {
    opacity: 1;
    box-shadow: 0 0 4px currentColor;
  }
  50% {
    opacity: 0.6;
    box-shadow: 0 0 8px currentColor;
  }
}
```
- Duration: 2s per message
- Ease: ease-in-out
- Transition: Vertical slide up
- Text only animation (no dot)

### Acceptance Criteria
- [ ] Chip displays below nav
- [ ] Messages rotate with pulse-glow effect on text
- [ ] 3 messages cycle infinitely
- [ ] Click scrolls to Batch Counter section

---

## Section 3: Hero Section

### Template Reference
`/v0 templates/New/orange-animation/components/hero-section.tsx`
`/v0 templates/New/orange-animation/components/split-flap-text.tsx`

### Background
**DARK** (#0A0A0A)

### Layout
```
                    [Status Chip]

         ╔══════════════════════════════════╗
         ║         B R E W C L A W          ║  ← SplitFlap or ASCII
         ╚══════════════════════════════════╝

    "Deploy your personal AI assistant in the
     time it takes to brew a coffee"

    Writes • Researches • Clears inbox • Sends briefs

                 [Try it now for free]

              $2 credits included • No code needed
```

### Brand Name Animation (A/B Test)

**Option A: SplitFlap (Recommended)**
- Airport departure board style flip animation
- Color: Espresso (#78350F) while flipping → Black bg + White text when settled
- Sound: Web Audio API click sounds (mutable)
- Staggered character entrance
- On hover: Re-triggers animation

**Option B: ASCII Shimmer**
```
██████╗ ██████╗ ███████╗██╗    ██╗ ██████╗██╗      █████╗ ██╗    ██╗
██╔══██╗██╔══██╗██╔════╝██║    ██║██╔════╝██║     ██╔══██╗██║    ██║
...
```
- Gradient shimmer: White → Espresso flash → White
- Animation: `background-position: -200% 0 → 200% 0` over 4s

### Copy
| Element | Copy |
|---------|------|
| Brand | BREWCLAW |
| Tagline | Deploy your personal AI assistant in the time it takes to brew a coffee |
| Sub-copy | Writes • Researches • Clears inbox • Sends briefs |
| CTA | Try it now for free |
| Trust | $2 credits included • No code needed |

### Acceptance Criteria
- [ ] Brand name displays with chosen animation
- [ ] Sound toggle for SplitFlap version
- [ ] Tagline readable on dark background
- [ ] Sub-copy displays inline with bullet separators
- [ ] CTA button links to signup funnel

---

## Section 4: Installation Process

### Reference
clawi.ai style (beating dot + liquid flow)

### Background
**LIGHT** (#FFFFFF)

### Layout
```
┌─────────────────────────────────────────────────────────────────┐
│   >_ Up and running in 3 minutes                               │
│                                                                 │
│   ┌──────────────────────┐    ┌────────────────────────────┐   │
│   │                      │    │                            │   │
│   │  ● Sign Up           │    │    [Demo Video Player]    │   │
│   │  │ Create account    │    │                            │   │
│   │  │                   │    │    Synced with steps       │   │
│   │  ○ Connect Messenger │    │                            │   │
│   │  │ Telegram, WhatsApp│    │                            │   │
│   │  │                   │    │                            │   │
│   │  ○ Connect AI        │    │                            │   │
│   │  │ API key or tokens │    │                            │   │
│   │  │                   │    │                            │   │
│   │  ○ Start Chatting    │    │                            │   │
│   │    Your AI is live   │    └────────────────────────────┘   │
│   └──────────────────────┘                                     │
└─────────────────────────────────────────────────────────────────┘
```

### Animation
- **Beating dot**: Active step has pulsing dot in espresso color
- **Liquid flow**: Coffee color flows down timeline as steps complete
- **Grey out**: Upcoming steps are greyed/muted
- **Video sync**: Demo video timestamps match step progression

### Steps Copy
| Step | Title | Description |
|------|-------|-------------|
| 1 | Sign Up | Create your account with email. Instant provisioning. |
| 2 | Connect Messenger | Telegram, WhatsApp (coming soon) |
| 3 | Connect AI | Use existing subscriptions / API key or buy tokens from us |
| 4 | Start Chatting | Your personal AI comes online immediately |

### Acceptance Criteria
- [ ] 4 steps display vertically with timeline
- [ ] Active step has beating dot animation
- [ ] Liquid flows down in coffee color
- [ ] Video embeds and syncs with steps
- [ ] Responsive: stacks on mobile

---

## Section 5: Comparison

### Template Reference
Use premium template style (no self-generated styles)

### Background
**LIGHT** (#FFFFFF)

### Layout
Two columns: Traditional Method (left) vs BrewClaw (right)

### Animation
- **Fade in**: Elements fade in on scroll (Intersection Observer)
- **Coffee brewing**: BrewClaw side shows coffee brewing animation to visualize time

### Copy
**Traditional Method (60 min total):**
| Step | Time |
|------|------|
| Purchasing local virtual machine | 15 min |
| Creating SSH keys and storing securely | 10 min |
| Connecting to the server via SSH | 5 min |
| Installing Node.js and NPM | 5 min |
| Installing OpenClaw | 7 min |
| Setting up OpenClaw | 10 min |
| Connecting to AI provider | 4 min |
| Pairing with Telegram | 4 min |
| **Total** | **60 min** |

*Note: If you're non-technical, multiply these times by 10.*

**BrewClaw:**
- Time: < Coffee brewing time
- Description: Pick a model, connect Telegram, deploy — done under 1 minute.
- Supporting: Servers, SSH and OpenClaw Environment are already set up.

### Acceptance Criteria
- [ ] Two-column comparison displays
- [ ] Traditional shows itemized breakdown
- [ ] BrewClaw shows coffee brewing animation
- [ ] Fade in on scroll
- [ ] No emojis, premium style

---

## Section 6: What You Get (Features)

### Reference
easyclaw.app style bento grid

### Background
**LIGHT** (#FFFFFF)

### Features (5 Cards)
| Feature | Title | Description | Visual |
|---------|-------|-------------|--------|
| 1 | Persistent Memory | Your preferences, context, and past conversations are remembered instantly | Memory icon/illustration |
| 2 | Privacy First | Your data stays private. We don't log your conversations. | Shield + "LOGGING DISABLED..." terminal |
| 3 | Always Awake | Your AI runs 24/7, ready to respond whenever you need it | Clock icon |
| 4 | Secure by Default | End-to-end encryption where supported | Lock icon |
| 5 | Any Messenger | WhatsApp, Telegram, Discord, Slack, Signal — all connected | Messenger logos (images) |

### Layout
Bento grid with mixed card sizes (some larger for Messenger card with logos)

### Animation
Match easyclaw.app feature card animations

### Acceptance Criteria
- [ ] 5 feature cards in bento grid
- [ ] Messenger card shows app logos
- [ ] Cards have subtle hover effects
- [ ] Responsive grid

---

## Section 7: Use Cases Marquee

### Template Reference
`/v0 templates/Old/premium-saa-s-landing-page`
Convert vertical animation to horizontal

### Background
**LIGHT** (#FFFFFF)

### Layout
```
        What can BrewClaw do for you?
       One assistant, thousands of use cases

← ← ← [Read email] [Draft replies] [Translate messages] [Organize inbox] ← ← ←

→ → → [Do taxes] [Track expenses] [Find prices] [Book travel] [Set goals] → → →

    PS. You can add as many use cases as you want via natural language
```

### Animation
- Row 1: Scrolls right to left (← ← ←)
- Row 2: Scrolls left to right (→ → →)
- Speed: ~45s per loop
- **Pause on hover**: Row pauses when mouse hovers
- Icons: Premium style icons from template

### Use Cases List
**Row 1:**
Read & summarize email, Draft replies, Translate messages, Organize inbox, Answer support tickets, Summarize documents, Schedule meetings, Remind deadlines, Plan your week

**Row 2:**
Do your taxes, Track expenses, Compare insurance, Manage subscriptions, Find discount codes, Price-drop alerts, Find best prices, Book travel, Set and track goals, Draft job descriptions

### Acceptance Criteria
- [ ] Two rows scroll in opposite directions
- [ ] Pause on hover
- [ ] Premium icons (no emojis)
- [ ] Smooth infinite loop

---

## Section 8: Skills Store

### Reference
ironclaw.sh skills store (visual reference)

### Background
**DARK** (#0A0A0A)

### Layout
```
   SKILLS STORE
   Extend your agent with one command

   Browse skills from skills.sh and ClawHub. Install any skill
   with a single command — your agent learns new capabilities instantly.

   ┌─────────────────────────────────────────────────────────────┐
   │ 🔧 Skills Directory  [58,237 skills]     [Search skills...] │
   │                                                              │
   │ [All] [Sales] [CRM] [Browser] [Frontend] [DevOps] [ML]      │
   │                                                              │
   │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐          │
   │ │crm-automation│ │linkedin-out..│ │lead-enrich...│          │
   │ │              │ │              │ │              │          │
   │ └──────────────┘ └──────────────┘ └──────────────┘          │
   └─────────────────────────────────────────────────────────────┘
```

### Interaction
- Phase 1: Fully developed if possible, otherwise clickable to external skills.sh
- Categories: All, Sales, CRM, Browser, Frontend, DevOps, ML
- Search: Functional search bar

### Acceptance Criteria
- [ ] Skills directory displays
- [ ] Category filters work
- [ ] Skill cards show name, description, stats
- [ ] Dark background contrasts with light sections

---

## Section 9: Batch Counter

### Design
Custom minimal approach (not cosmic theme)

### Background
**LIGHT** (#FFFFFF)

### Layout
```
                    1,100
               PEOPLE SIGNED UP

    ════════════════════════════════════════
    |  Batch 1 (50)  |  Batch 2 (350)  | Batch 3 (700)  |

           Batch 3 filling up — 19 spots left

    [✓ Batch 1 full] [✓ Batch 2 full] [Batch 3 - 19 left]
```

### Animation
- **Count-up**: Number animates from 0 to target on viewport entry
- **Progress bar**: Fills with subtle animation
- Preset numbers (not real-time)

### Data
| Batch | Capacity | Status |
|-------|----------|--------|
| Batch 1 | 50 | Full |
| Batch 2 | 350 | Full |
| Batch 3 | 700 | Filling |

### Acceptance Criteria
- [ ] Counter displays with count-up animation
- [ ] Progress bar shows batch fill status
- [ ] Batch tags show full/remaining

---

## Section 10: Pricing

### Template Reference
`/v0 templates/New/sticky-nav-pricing/components/pricing.tsx`

### Background
**DARK** (#0A0A0A)

### Layout
Three pricing tiers in horizontal cards

### Tiers
| Tier | Badge | Price | Description | Features | Resources |
|------|-------|-------|-------------|----------|-----------|
| Basic | POPULAR | $30/mo | For casual personal use | Full Agent abilities, Full Linux environment, Great for simple tasks | 1 vCPU, 2 GB RAM, 10 GB Storage |
| Pro | BEST VALUE | $60/mo | For power users | More AI credits, Better performance, Works best for most people | 2 vCPU, 2 GB RAM, 20 GB Storage |
| Ultra | MULTIAGENT | $200/mo | For teams and heavy usage | Up to 3 parallel agents, Ideal for intense workflows, Best for advanced models | 6 vCPU, 6 GB RAM, 60 GB Storage |

### Animation
- Border beam animation on Pro card (highlighted)
- CTA buttons use shader button style

### Acceptance Criteria
- [ ] 3 pricing cards display
- [ ] Pro tier highlighted as "BEST VALUE"
- [ ] CTA buttons link to signup with plan parameter
- [ ] Resource specs display clearly

---

## Section 11: Final CTA

### Background
**DARK** (#0A0A0A)

### Layout
```
           Get real work done by world's fastest growing software

                        Ready to get started?

              Download BrewClaw and set up your AI in seconds.

                     ┌──────────────────────────┐
                     │   Try it now for free    │  ← Shader button
                     └──────────────────────────┘

                          More options →

                   $2 credits included for new users
```

### Button
- Shader button with coffee color outline animation
- Espresso (#78350F) shimmer outline, not full fill
- 3D liquid metal effect from template

### Copy
| Element | Copy |
|---------|------|
| Pre-headline | Get real work done by world's fastest growing software |
| Headline | Ready to get started? |
| Subhead | Download BrewClaw and set up your AI in seconds. |
| CTA | Try it now for free |
| Secondary | More options → (links to pricing) |
| Trust | $2 credits included for new users |

### Acceptance Criteria
- [ ] Headline displays prominently
- [ ] Shader button with coffee outline animation
- [ ] Trust indicator displays below
- [ ] Secondary link scrolls to pricing

---

## Section 12: Footer

### Reference
easyclaw.app footer style (4 columns)

### Background
Different shade (darker than light sections, e.g., #111111 or #0A0A0A)

### Layout (4 Columns)
```
─────────────────────────────────────────────────────────────────────────

  L O C A T I O N        C O N T A C T           S O C I A L         L E G A L

  Gurugram, IN           support@brewclaw.com    GitHub              Privacy Policy

                         System Console          X / Twitter

                                                 LinkedIn

                                                 Instagram

─────────────────────────────────────────────────────────────────────────

              © 2025 BREWCLAW · ALL SYSTEMS NOMINAL.

```

### Column Content

**LOCATION**
| Item | Value |
|------|-------|
| City | Gurugram, IN |

**CONTACT**
| Item | Link |
|------|------|
| Email | support@brewclaw.com (mailto:) |
| System Console | brewclaw.com/console (Phase 2) or disabled |

**SOCIAL**
| Platform | Link |
|----------|------|
| GitHub | github.com/[repo] |
| X / Twitter | twitter.com/[handle] |
| LinkedIn | linkedin.com/in/divy-kairoth |
| Instagram | instagram.com/[handle] (optional) |

**LEGAL**
| Item | Link |
|------|------|
| Privacy Policy | brewclaw.com/privacy |

### Copyright Line
`© 2025 BREWCLAW · ALL SYSTEMS NOMINAL.`

Or alternative: `© 2025 BREWCLAW · BUILT BY DIVY KAIROTH`

### Styling
- Column headers: Uppercase, letter-spacing (tracking), muted color
- Links: Regular weight, hover underline
- Dark background with subtle separation from CTA
- Line separator above and between content/copyright

### Acceptance Criteria
- [ ] 4-column layout displays correctly
- [ ] Column headers have tracking/spacing
- [ ] All links functional
- [ ] Email opens mail client
- [ ] Copyright with tagline at bottom
- [ ] Responsive: stacks on mobile

---

## Master Template Reference

| Section | Template Path |
|---------|---------------|
| Nav | `/v0 templates/New/sticky-nav-pricing/components/navbar.tsx` |
| Chip | `/v0 templates/New/sticky-nav-pricing/app/globals.css` (pulse-glow) |
| Hero | `/v0 templates/New/orange-animation/` (SplitFlap + sound) |
| Steps | clawi.ai reference (liquid flow) |
| Comparison | Premium template style |
| Features | easyclaw.app reference |
| Marquee | `/v0 templates/Old/premium-saa-s-landing-page` (horizontal convert) |
| Skills | ironclaw.sh reference |
| Counter | Custom minimal |
| Pricing | `/v0 templates/New/sticky-nav-pricing/components/pricing.tsx` |
| CTA | `/v0 templates/Old/shader-button/components/liquid-metal-button.tsx` |
| Footer | ironclaw.sh footer reference |

---

## Master Link Reference

| Location | Element | Destination |
|----------|---------|-------------|
| Nav | Logo | `brewclaw.com` |
| Nav | Features | Scroll → Section 7 |
| Nav | Pricing | Scroll → Section 10 |
| Nav | Docs | Disabled (Phase 2) |
| Nav | FAQs | Scroll → FAQs or disabled |
| Nav | Get Started | `brewclaw.com/signup` |
| Chip | Any message | Scroll → Section 9 |
| Hero | CTA | `brewclaw.com/signup` |
| Pricing | Basic CTA | `brewclaw.com/signup?plan=basic` |
| Pricing | Pro CTA | `brewclaw.com/signup?plan=pro` |
| Pricing | Ultra CTA | `brewclaw.com/signup?plan=ultra` |
| CTA | Primary | `brewclaw.com/signup` |
| CTA | More options | Scroll → Section 10 |
| Footer | BREWCLAW | `brewclaw.com` |
| Footer | OpenClaw | OpenClaw website/repo |
| Footer | GitHub | `github.com/[repo]` |
| Footer | LinkedIn | `linkedin.com/in/divy-kairoth` |
| Footer | X | `twitter.com/[handle]` |
| Footer | Divy Kairoth | `linkedin.com/in/divy-kairoth` |

---

## Animation Library Reference

| Animation | Source | Usage |
|-----------|--------|-------|
| shimmer | `sticky-nav-pricing/globals.css` | Buttons, brand |
| pulse-glow | `sticky-nav-pricing/globals.css` | Status chip text |
| border-beam | `sticky-nav-pricing/globals.css` | Pricing cards |
| marquee | `sticky-nav-pricing/globals.css` | Use cases |
| SplitFlap | `orange-animation/split-flap-text.tsx` | Brand name |
| Liquid Metal | `shader-button/liquid-metal-button.tsx` | CTA buttons |
| Fade in scroll | GSAP ScrollTrigger | Comparison, sections |

---

## Phase 2 Items (Out of Scope)

- Docs section and docs.brewclaw.com
- WhatsApp integration
- Interactive Skills Store (full filtering)
- Real-time batch counter
- Annual pricing toggle
- Social proof/testimonials
- Blog section

---

## Development Notes

1. **No emojis** - Use premium icons only (Lucide, custom SVGs)
2. **No self-generated styles** - Copy exact styles from templates
3. **A/B Test** - Build both SplitFlap and ASCII shimmer for hero
4. **Shadcn** - Use `npx shadcn@latest` for any missing components
5. **Sound** - SplitFlap audio is mutable, starts muted

---

*Document Version: 2.0*
*Last Updated: February 2025*
*Author: Claude (AI-assisted)*
*Owner: Divy Kairoth*
