# AI Providers for 2OpenClaw

> **CRITICAL WARNING: Free Tier APIs DO NOT WORK with OpenClaw!**
>
> OpenClaw's system prompt is ~10,000+ tokens. Free APIs have strict limits:
> - **Groq free**: 6,000-12,000 TPM limit → FAILS on first message
> - **OpenRouter free**: Rate limited → FAILS
> - **Gemini free**: Quota exhausts quickly → FAILS
>
> **BYOK (Bring Your Own Key) is REQUIRED for reliable operation.**
> We recommend Anthropic Claude ($3-15/M tokens) or Google Gemini ($0.075/M tokens).

---

## Recommended Providers (BYOK Required)

### Tier 1 — Most Reliable

| Provider | Model | Free Tier | Rate Limit | Quality | Reliability |
|----------|-------|-----------|------------|---------|-------------|
| **Groq** | Llama 3.3 70B | ✅ Yes | 30 req/min | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Google AI Studio** | Gemini 2.0 Flash | ✅ Yes | 15 req/min | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Anthropic** | Claude Sonnet | $5 free credit | Until exhausted | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

### Tier 2 — Good Alternatives

| Provider | Model | Free Tier | Notes |
|----------|-------|-----------|-------|
| **OpenRouter** | Various | Limited free | Aggregator, can route to free models |
| **Together AI** | Llama, Mistral | $25 credit | Good for testing |
| **Cerebras** | Llama 3.3 | Free | Very fast inference, rate limited |
| **Fireworks AI** | Various | Free tier | Good selection |

### Tier 3 — Paid (BYOK)

| Provider | Model | Starting Price | Best For |
|----------|-------|----------------|----------|
| **Anthropic** | Claude Opus/Sonnet | $3/$15 per 1M tokens | Best quality |
| **OpenAI** | GPT-4o | $5/15 per 1M tokens | Good all-rounder |
| **DeepSeek** | DeepSeek V3 | $0.14/0.28 per 1M | Budget option |

---

## Provider Setup Instructions

### Groq (Recommended Free)

1. Go to [console.groq.com](https://console.groq.com)
2. Sign up with Google/GitHub
3. Go to API Keys → Create API Key
4. Copy the key (starts with `gsk_`)

**OpenClaw Config:**
```json
{
  "env": {
    "vars": {
      "GROQ_API_KEY": "gsk_xxx..."
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "groq/gemma2-9b-it"
      }
    }
  }
}
```

### Google AI Studio

1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Click "Get API Key"
3. Create a project if needed
4. Copy the key

**OpenClaw Config:**
```json
{
  "env": {
    "vars": {
      "GEMINI_API_KEY": "AIza..."
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "google/gemini-2.0-flash"
      }
    }
  }
}
```

### Anthropic

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up (requires phone verification)
3. Add payment method (get $5 free credit)
4. Go to API Keys → Create Key
5. Copy the key (starts with `sk-ant-`)

**OpenClaw Config:**
```json
{
  "env": {
    "vars": {
      "ANTHROPIC_API_KEY": "sk-ant-xxx..."
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "anthropic/claude-sonnet-4-5"
      }
    }
  }
}
```

---

## 2OpenClaw Default Configuration

2OpenClaw requires BYOK (Bring Your Own Key). Recommended providers:

| Provider | Model | Price | Notes |
|----------|-------|-------|-------|
| **Anthropic Claude** | claude-sonnet-4-5 | $3-15/M tokens | Best quality, recommended |
| **Google Gemini** | gemini-2.0-flash | $0.075/M tokens | Budget option, good quality |
| **OpenAI GPT-4o** | gpt-4o | $5-15/M tokens | Good all-rounder |

**Free tiers are NOT supported** due to OpenClaw's large system prompt (~10K tokens).

---

## Why Free Tiers Don't Work

OpenClaw's system prompt includes:
- Full agent capabilities description (~3K tokens)
- Tool definitions and schemas (~4K tokens)
- Context and conversation history (~3K+ tokens)

This exceeds free tier limits:
- Groq: 6,000-12,000 TPM → First message fails
- Gemini free: 60 RPM but quota exhausts in hours
- OpenRouter free: Heavy rate limiting

**Solution**: Users must provide their own API key (BYOK model).

---

## Cost Estimation

For BYOK users, typical monthly costs:

| Usage | Anthropic | OpenAI | Groq |
|-------|-----------|--------|------|
| Light (100 msgs/day) | $2-5 | $3-7 | Free |
| Medium (500 msgs/day) | $10-20 | $15-30 | Free* |
| Heavy (2000 msgs/day) | $40-80 | $60-120 | Free* |

*Groq may rate limit heavy users; recommend BYOK for heavy usage.
