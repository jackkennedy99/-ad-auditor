import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const EXTRACTION_PROMPT = `You are reading a Meta Ads Manager screenshot showing ad performance data.

Extract these exact metrics and return them as a JSON object. Read the exact numbers shown — be extremely precise with decimals.

CRITICAL ACCURACY RULES:
- Read every digit carefully — 14.53% is NOT 1.453%, 4.5% is NOT 0.45%
- Percentages like "14.53%" should be returned as 14.53, not 1.453 or 145.3
- Small percentages like "0.87%" should be returned as 0.87
- Dollar amounts like "$1.24" should be returned as 1.24
- ROAS like "3.2x" should be returned as 3.2 (strip the x)
- If you're unsure between two readings, pick the one that makes sense in context (e.g. a hook rate of 14% is plausible, 1.4% or 140% are not)

Metrics to extract:

KEY METRICS:
1. amountSpent — Total spend in dollars. May be labeled "Amount Spent", "Spend".
2. cpm — Cost per 1,000 impressions in dollars. Labeled "CPM", "Cost per 1,000 Impressions".
3. conversionValue — Total purchase revenue attributed. May be labeled "Purchase Conversion Value", "Conversion Value", "Revenue".
4. roas — Return on ad spend as a number. May be labeled "Purchase ROAS", "ROAS", "Return on Ad Spend". Strip "x" suffix.
5. cpa — Cost per purchase/acquisition in dollars. May be labeled "Cost per Purchase", "CPA", "Cost per Result" (purchase campaigns).

SOFT METRICS:
6. hookRate — HOOK RATE ONLY. This is the percentage of impressions that resulted in at least a 3-second view. Labeled "Hook Rate", "Video Hook Rate", or "3-Second Video Views Rate". It measures whether the opening of the video stopped the scroll. Typical range: 10–40%. DO NOT confuse with Hold Rate.
7. holdRate — HOLD RATE ONLY. This is how much of the video people watched on average, expressed as a percentage of the video length. Labeled "Hold Rate", "Video Average Play Time %", or "Retention Rate". It measures whether viewers stayed engaged after the hook. Typical range: 15–60%. DO NOT confuse with Hook Rate.
CRITICAL: hookRate and holdRate are two different metrics. Hook Rate = did they stop scrolling (first 3 seconds). Hold Rate = did they keep watching (average through the video). Read each column header carefully before assigning values.
8. ctr — Link Click CTR as a percentage. Must be LINK click CTR specifically. May be labeled "CTR (Link Click-Through Rate)", "Link CTR". Typical range: 0.3–5%.
9. linkClicks — Raw number of link clicks. Labeled "Link Clicks".
10. cplc — Cost per link click in dollars. May be labeled "CPC (Cost per Link Click)", "Cost per Link Click", "CPLC".
11. lpv — Landing Page Views count (raw number). Labeled "Landing Page Views".
12. cplpv — Cost per landing page view in dollars. May be labeled "Cost per Landing Page View", "CPLPV".

HARD METRICS:
13. atc — Add to Carts count (raw number). May be labeled "Adds to Cart", "Add to Cart", "ATC".
14. initiateCheckout — Initiate Checkouts count (raw number). May be labeled "Checkouts Initiated", "Initiate Checkout".
15. purchases — Total purchases count (raw number). Labeled "Purchases".

CALCULATED (only if NOT already shown as a column — calculate from raw values if both are visible):
16. lpQuality — Landing Page Views ÷ Link Clicks × 100. Only calculate if not shown directly.
17. atcPurchase — Purchases ÷ Add to Carts × 100. Only calculate if not shown directly.

CURRENCY DETECTION:
Look at cost-based metrics (Amount Spent, CPM, CPA, Cost per Link Click, Cost per Landing Page View, Conversion Value) and identify the currency symbol shown. Add "detectedCurrency" to your JSON: return "$" if dollar signs are used, "£" if pound signs are used, or null if unclear.

Rules:
- Strip ALL currency symbols ($, £), percentage signs (%), and multipliers (x) — return only raw numeric values
- Do NOT scale or divide values — if the screenshot shows 14.53%, return 14.53
- If a metric is not visible or cannot be determined, return null
- Do not guess or approximate — only return values clearly visible or directly calculable
- Return ONLY a valid JSON object with no other text, explanation, or markdown

JSON format (no other text):
{"amountSpent":number|null,"cpm":number|null,"conversionValue":number|null,"roas":number|null,"cpa":number|null,"hookRate":number|null,"holdRate":number|null,"ctr":number|null,"linkClicks":number|null,"cplc":number|null,"lpv":number|null,"cplpv":number|null,"lpQuality":number|null,"atc":number|null,"initiateCheckout":number|null,"purchases":number|null,"atcPurchase":number|null,"detectedCurrency":"$"|"£"|null}`

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  const { imageBase64, mimeType } = await req.json()

  if (!imageBase64) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 })
  }

  const client = new Anthropic({ apiKey })

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType || 'image/png',
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: EXTRACTION_PROMPT,
            },
          ],
        },
      ],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parsed: any
    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      return NextResponse.json(
        { error: 'Could not parse metrics from screenshot. Try a clearer screenshot or enter manually.' },
        { status: 422 }
      )
    }

    const { detectedCurrency, ...values } = parsed
    return NextResponse.json({ values, detectedCurrency: detectedCurrency || null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
