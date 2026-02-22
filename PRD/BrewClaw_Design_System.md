# BrewClaw Design System v1.0

**Last Updated:** February 2025
**Product:** BrewClaw
**Domain:** brewclaw.com

---

## 1. Color Palette

### 1.1 Base Colors (Espresso Theme)

| Token | Hex | OKLCH | Usage |
|-------|-----|-------|-------|
| `--color-black` | `#000000` | oklch(0 0 0) | Hero background, footer |
| `--color-near-black` | `#0A0A0A` | oklch(0.09 0 0) | Primary dark background |
| `--color-card-bg` | `#111111` | oklch(0.12 0 0) | Card backgrounds |
| `--color-input-bg` | `#1A1A1A` | oklch(0.15 0 0) | Input fields, code blocks |
| `--color-border` | `#222222` | oklch(0.18 0 0) | Borders, dividers |
| `--color-border-subtle` | `#333333` | oklch(0.25 0 0) | Subtle borders |
| `--color-muted` | `#666666` | oklch(0.45 0 0) | Muted text, icons |
| `--color-secondary` | `#999999` | oklch(0.65 0 0) | Secondary text |
| `--color-white` | `#FFFFFF` | oklch(1 0 0) | Primary text on dark |

### 1.2 Coffee Accent Colors (Use Sparingly)

| Token | Hex | Name | Usage |
|-------|-----|------|-------|
| `--color-dark-roast` | `#451A03` | Dark Roast | Deepest accent, rare use |
| `--color-espresso` | `#78350F` | Espresso | Primary accent (subtle) |
| `--color-medium-roast` | `#92400E` | Medium Roast | Hover states |
| `--color-caramel` | `#B45309` | Caramel | Active states |
| `--color-amber` | `#D97706` | Primary Amber | CTA outlines only |

**Usage Rules:**
- Coffee colors should appear on **<5% of total page area**
- Use primarily for: button outlines, subtle highlights, section dividers
- Never use as large background fills
- Never use for body text

### 1.3 Gradients

```css
/* Dark Roast Gradient - For subtle backgrounds */
--gradient-dark-roast: linear-gradient(135deg, #451A03 0%, #78350F 50%, #92400E 100%);

/* Espresso Fade - For section transitions */
--gradient-espresso-fade: linear-gradient(180deg, #0A0A0A 0%, #111111 100%);

/* Outline Shimmer - For CTA button outline animation */
--gradient-outline-shimmer: linear-gradient(90deg,
  transparent 0%,
  #78350F 25%,
  #D97706 50%,
  #78350F 75%,
  transparent 100%
);
```

---

## 2. Typography

### 2.1 Font Stack

```css
/* Brand Display - ASCII Art */
--font-brand: 'Geist Mono', 'JetBrains Mono', 'Fira Code', monospace;

/* Headings */
--font-heading: 'Space Grotesk', 'Inter', system-ui, sans-serif;

/* Body */
--font-body: 'Geist', 'Inter', system-ui, sans-serif;

/* Code */
--font-mono: 'Geist Mono', 'JetBrains Mono', monospace;
```

### 2.2 Font Imports

```html
<!-- Google Fonts -->
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">

<!-- Geist (from Vercel CDN) -->
<link href="https://cdn.jsdelivr.net/npm/geist@1.2.2/dist/fonts/geist-sans/index.css" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/geist@1.2.2/dist/fonts/geist-mono/index.css" rel="stylesheet">
```

### 2.3 Type Scale

| Token | Size | Line Height | Weight | Usage |
|-------|------|-------------|--------|-------|
| `--text-xs` | 12px / 0.75rem | 1.5 | 400 | Badges, captions |
| `--text-sm` | 14px / 0.875rem | 1.5 | 400 | Nav items, small text |
| `--text-base` | 16px / 1rem | 1.6 | 400 | Body text |
| `--text-lg` | 18px / 1.125rem | 1.6 | 400 | Lead paragraphs |
| `--text-xl` | 20px / 1.25rem | 1.5 | 500 | Card titles |
| `--text-2xl` | 24px / 1.5rem | 1.4 | 500 | Section subtitles |
| `--text-3xl` | 30px / 1.875rem | 1.3 | 600 | Section titles |
| `--text-4xl` | 36px / 2.25rem | 1.2 | 500 | Page headlines |
| `--text-5xl` | 48px / 3rem | 1.1 | 600 | Hero headline |
| `--text-6xl` | 60px / 3.75rem | 1.1 | 700 | Large display |

### 2.4 Typography Application

| Element | Font | Size | Weight | Color |
|---------|------|------|--------|-------|
| Brand Name (ASCII) | Geist Mono | 10px (monospace art) | 400 | White with shimmer |
| Hero Headline | Space Grotesk | 48px | 600 | White |
| Section Title | Space Grotesk | 36px | 500 | White |
| Card Title | Space Grotesk | 20px | 500 | White |
| Body Text | Geist | 16px | 400 | #999999 |
| Nav Items | Geist | 14px | 500 | White |
| Button Text | Geist | 14px | 600 | #666666 |
| Code | Geist Mono | 14px | 400 | #D97706 (subtle) |

---

## 3. Components

### 3.1 CTA Button (Shader Outline)

**Design:** 3D liquid metal button with animated coffee-colored outline only

```css
/* Button Dimensions */
--btn-width: 180px;
--btn-height: 48px;
--btn-radius: 100px; /* Full pill */

/* Inner Fill */
background: linear-gradient(180deg, #202020 0%, #000000 100%);

/* Outer Border - Animated Shader */
border: 2px solid transparent;
border-image: var(--gradient-outline-shimmer);
animation: outline-shimmer 3s linear infinite;
```

**States:**
| State | Effect |
|-------|--------|
| Default | Subtle shadow, shader speed 0.6 |
| Hover | Enhanced shadow, shader speed 1.0 |
| Active/Press | Scale 0.98, translate Y +1px, shader speed 2.4 |

**Animation Spec:**
```css
@keyframes outline-shimmer {
  0% {
    border-color: #451A03;
    box-shadow: 0 0 0 1px #451A03;
  }
  50% {
    border-color: #D97706;
    box-shadow: 0 0 8px 1px rgba(217, 119, 6, 0.3);
  }
  100% {
    border-color: #451A03;
    box-shadow: 0 0 0 1px #451A03;
  }
}
```

### 3.2 Input Fields

```css
/* Base Input */
background: #1A1A1A;
border: 1px solid #222222;
border-radius: 8px;
padding: 12px 16px;
color: #FFFFFF;
font-family: var(--font-body);
font-size: 16px;

/* Placeholder */
color: #666666;

/* Focus */
border-color: #333333;
box-shadow: 0 0 0 3px rgba(51, 51, 51, 0.3);

/* Hover */
border-color: #333333;
```

### 3.3 Cards

```css
/* Base Card */
background: #111111;
border: 1px solid #222222;
border-radius: 16px;
padding: 24px;

/* Hover */
border-color: #333333;

/* Feature Card (Bento) - With subtle coffee accent */
&.featured {
  border-color: #451A03; /* Very subtle espresso */
}
```

### 3.4 Navigation

```css
/* Nav Container */
position: fixed;
top: 0;
background: transparent; /* Becomes solid on scroll */
backdrop-filter: blur(12px);
border-bottom: 1px solid transparent; /* Becomes #222 on scroll */
height: 64px;
z-index: 1000;

/* On Scroll (after 50px) */
background: rgba(10, 10, 10, 0.95);
border-bottom: 1px solid #222222;
```

### 3.5 Status Chip (Rotating)

```css
/* Chip Container */
background: #111111;
border: 1px solid #222222;
border-radius: 9999px;
padding: 8px 16px;
font-size: 14px;
font-family: var(--font-body);

/* Animation */
animation: chip-rotate 6s ease-in-out infinite; /* 3 messages × 2s each */
```

---

## 4. Animations

### 4.1 ASCII Brand Shimmer

```css
@keyframes ascii-shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.brand-ascii {
  background: linear-gradient(
    90deg,
    #FFFFFF 0%,
    #FFFFFF 40%,
    #D97706 50%, /* Subtle coffee flash */
    #FFFFFF 60%,
    #FFFFFF 100%
  );
  background-size: 200% 100%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: ascii-shimmer 4s ease-in-out infinite;
}
```

### 4.2 Chip Message Rotation

```css
@keyframes chip-slide-up {
  0% {
    transform: translateY(100%);
    opacity: 0;
  }
  10% {
    transform: translateY(0);
    opacity: 1;
  }
  90% {
    transform: translateY(0);
    opacity: 1;
  }
  100% {
    transform: translateY(-100%);
    opacity: 0;
  }
}

.chip-message {
  animation: chip-slide-up 2s ease-in-out;
}
```

### 4.3 Use Cases Marquee

```css
@keyframes marquee-left {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}

@keyframes marquee-right {
  0% { transform: translateX(-50%); }
  100% { transform: translateX(0); }
}

.marquee-row-1 {
  animation: marquee-left 45s linear infinite;
}

.marquee-row-2 {
  animation: marquee-right 45s linear infinite;
}

/* Pause on hover */
.marquee-row:hover {
  animation-play-state: paused;
}
```

### 4.4 Installation Steps Progress

```css
@keyframes step-activate {
  0% {
    opacity: 0.3;
    transform: scale(0.95);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.step {
  opacity: 0.3;
  transition: all 0.5s ease;
}

.step.active {
  opacity: 1;
  animation: step-activate 0.5s ease forwards;
}

.step.completed {
  opacity: 0.7;
}

.step.completed .number {
  background: #78350F; /* Espresso checkmark */
}
```

### 4.5 Liquid Metal Button Shader

Using `@paper-design/shaders` library:

```javascript
// Shader Configuration
const shaderConfig = {
  u_repetition: 4,
  u_softness: 0.5,
  u_shiftRed: 0.3,
  u_shiftBlue: 0.3,
  u_distortion: 0,
  u_contour: 0,
  u_angle: 45,
  u_scale: 8,
  u_shape: 1,
  u_offsetX: 0.1,
  u_offsetY: -0.1,
};

// Speed States
const speedStates = {
  default: 0.6,
  hover: 1.0,
  click: 2.4,
};

// Apply coffee gradient to shader colors
// Modify shader to use espresso (#78350F) to amber (#D97706) range
```

### 4.6 Batch Counter Animation

```css
@keyframes count-up {
  0% {
    opacity: 0;
    transform: translateY(10px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

.counter-number {
  animation: count-up 1s ease-out forwards;
}

/* Progress bar fill */
@keyframes fill-progress {
  0% { width: 0%; }
  100% { width: var(--progress-percent); }
}

.progress-fill {
  animation: fill-progress 1.5s ease-out forwards;
}
```

---

## 5. Scroll Animations

### 5.1 Lobster Claw + Human Hand Animation

**Concept:** Two hands enter from opposite sides on scroll, meeting in the middle with a V60 coffee dripper

```css
/* Left Hand (Lobster Claw) */
@keyframes hand-enter-left {
  0% {
    transform: translateX(-100%) rotate(-15deg);
    opacity: 0;
  }
  100% {
    transform: translateX(0) rotate(0deg);
    opacity: 1;
  }
}

/* Right Hand (Human) */
@keyframes hand-enter-right {
  0% {
    transform: translateX(100%) rotate(15deg);
    opacity: 0;
  }
  100% {
    transform: translateX(0) rotate(0deg);
    opacity: 1;
  }
}

/* V60 Dripper (Center) */
@keyframes v60-appear {
  0% {
    transform: translateY(-30px) scale(0.8);
    opacity: 0;
  }
  100% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}

/* Trigger on scroll */
.hands-animation {
  opacity: 0;
}

.hands-animation.in-view {
  .left-hand {
    animation: hand-enter-left 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }
  .right-hand {
    animation: hand-enter-right 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s forwards;
  }
  .v60-dripper {
    animation: v60-appear 0.6s ease-out 0.4s forwards;
  }
}
```

**Implementation Notes:**
- Use Intersection Observer API to trigger on scroll
- Left hand: Lobster/claw SVG illustration
- Right hand: Human hand SVG illustration
- V60 dripper: Coffee brewing equipment SVG
- Position: Above hero or between sections
- Animation timing: Left (0s) → Right (0.1s) → V60 (0.4s)

### 5.2 Section Fade In

```css
@keyframes fade-in-up {
  0% {
    opacity: 0;
    transform: translateY(30px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

.section {
  opacity: 0;
}

.section.in-view {
  animation: fade-in-up 0.6s ease-out forwards;
}
```

---

## 6. Spacing System

### 6.1 Spacing Scale

```css
--space-0: 0;
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
--space-20: 80px;
--space-24: 96px;
--space-32: 128px;
```

### 6.2 Section Spacing

| Section | Top Padding | Bottom Padding |
|---------|-------------|----------------|
| Nav | 0 | 0 (fixed) |
| Hero | 120px | 80px |
| Features | 80px | 80px |
| Comparison | 80px | 80px |
| Pricing | 80px | 80px |
| CTA | 80px | 80px |
| Footer | 48px | 48px |

---

## 7. Shadows & Elevation

```css
/* Subtle shadow for cards */
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.5);

/* Medium shadow for elevated elements */
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);

/* Large shadow for modals/dropdowns */
--shadow-lg: 0 10px 25px rgba(0, 0, 0, 0.5);

/* Button shadow */
--shadow-button:
  0 0 0 1px rgba(0, 0, 0, 0.3),
  0 2px 5px rgba(0, 0, 0, 0.15),
  0 9px 9px rgba(0, 0, 0, 0.12);

/* Button shadow hover */
--shadow-button-hover:
  0 0 0 1px rgba(0, 0, 0, 0.4),
  0 4px 4px rgba(0, 0, 0, 0.15),
  0 8px 5px rgba(0, 0, 0, 0.1);
```

---

## 8. Border Radius

```css
--radius-none: 0;
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;
--radius-2xl: 24px;
--radius-full: 9999px; /* Pills, buttons */
```

---

## 9. Z-Index Scale

```css
--z-base: 0;
--z-dropdown: 100;
--z-sticky: 500;
--z-nav: 1000;
--z-modal-backdrop: 1100;
--z-modal: 1200;
--z-tooltip: 1300;
--z-toast: 1400;
```

---

## 10. Breakpoints

```css
--breakpoint-sm: 640px;   /* Mobile landscape */
--breakpoint-md: 768px;   /* Tablet */
--breakpoint-lg: 1024px;  /* Small desktop */
--breakpoint-xl: 1280px;  /* Desktop */
--breakpoint-2xl: 1536px; /* Large desktop */
```

---

## 11. Transition Timing

```css
/* Standard easing */
--ease-default: cubic-bezier(0.4, 0, 0.2, 1);

/* Bouncy easing (for buttons) */
--ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);

/* Smooth easing */
--ease-smooth: cubic-bezier(0.45, 0, 0.55, 1);

/* Duration */
--duration-fast: 150ms;
--duration-normal: 300ms;
--duration-slow: 500ms;
--duration-animation: 800ms;
```

---

## 12. CSS Variables Summary

```css
:root {
  /* Colors - Base */
  --color-black: #000000;
  --color-near-black: #0A0A0A;
  --color-card-bg: #111111;
  --color-input-bg: #1A1A1A;
  --color-border: #222222;
  --color-muted: #666666;
  --color-secondary: #999999;
  --color-white: #FFFFFF;

  /* Colors - Coffee Accents (use sparingly) */
  --color-dark-roast: #451A03;
  --color-espresso: #78350F;
  --color-medium-roast: #92400E;
  --color-caramel: #B45309;
  --color-amber: #D97706;

  /* Fonts */
  --font-brand: 'Geist Mono', monospace;
  --font-heading: 'Space Grotesk', sans-serif;
  --font-body: 'Geist', sans-serif;
  --font-mono: 'Geist Mono', monospace;

  /* Radius */
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-card: 0 4px 6px rgba(0, 0, 0, 0.4);

  /* Transitions */
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
  --duration-normal: 300ms;
}
```

---

## 13. Implementation Checklist

### Fonts
- [ ] Import Geist from Vercel CDN
- [ ] Import Space Grotesk from Google Fonts
- [ ] Configure fallback fonts

### Colors
- [ ] Set up CSS custom properties
- [ ] Create Tailwind config with custom colors
- [ ] Verify color contrast ratios (WCAG AA)

### Components
- [ ] Build shader button with outline animation
- [ ] Build rotating status chip
- [ ] Build feature cards (bento grid)
- [ ] Build marquee component

### Animations
- [ ] Implement ASCII shimmer effect
- [ ] Implement chip rotation
- [ ] Implement marquee scroll
- [ ] Implement scroll-triggered animations
- [ ] Implement hands + V60 scroll animation

### Responsive
- [ ] Test all breakpoints
- [ ] Adjust typography scale for mobile
- [ ] Stack layouts on smaller screens

---

*Design System Version: 1.0*
*Created: February 2025*
*Owner: Divy Kairoth*
