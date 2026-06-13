import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const EXTRACTION_PROMPT = `You are reading a Meta Ads Manager screenshot showing ad performance data.

Extract these exact metrics and return them as a JSON object. Read the exact numbers shown — be precise.

Metrics to extract:

KEY METRICS:
1. amountSpent — Total spend in dollars. May be labeled "Amount Spent", "Spend".
2. cpm — Cost per 1,000 impressions in dollars. Labeled "CPM", "Cost per 1,000 Impressions".
3. conversionValue — Total purchase revenue attributed. May be labeled "Purchase Conversion Value", "Conversion Value", "Revenue".
4. roas — Return on ad spend as a number. May be labeled "Purchase ROAS", "ROAS", "Return on Ad Spend". Strip "x" suffix.
5. cpa — Cost per purchase/acquisition in dollars. May be labeled "Cost per Purchase", "CPA", "Cost per Result" (purchase campaigns).

SOFT METRICS:
6. hookRate — Hook Rate as a percentage. May be labeled "Hook Rate", "Video Hook Rate", or calculated as (3-Second Video Views ÷ Impressions) × 100.
7. holdRate — Hold Rate as a percentage. May be labeled "Hold Rate", average watch time as % of video length, or ThruPlay Rate.
8. ctr — Link Click CTR as a percentage. Must be LINK click CTR specifically. May be labeled "CTR (Link Click-Through Rate)", "Link CTR".
9. linkClicks — Raw number of link clicks. Labeled "Link Clicks".
10. cplc — Cost per link click in dollars. May be labeled "CPC (Cost per Link Click)", "Cost per Link Click", "CPLC".
11. lpv — Landing Page Views count (raw number). Labeled "Landing Page Views".
12. cplpv — Cost per landing page view in dollars. May be labeled "Cost per Landing Page View", "CPLPV".
13. lpQuality — Landing Page Views ÷ Link Clicks × 100 as a percentage. If not shown directly, calculate from lpv and linkClicks if both are visible.

HARD METRICS:
14. atc — Add to Carts count (raw number). May be labeled "Adds to Cart", "Add to Cart", "ATC".
15. initiateCheckout — Initiate Checkouts count (raw number). May be labeled "Checkouts Initiated", "Initiate Checkout".
16. purchases — Total purchases count (raw number). Labeled "Purchases".
17. atcPurchase — Purchases ÷ Add to Carts × 100 as a percentage. Calculate from raw numbers if both are visible.

Rules:
- Strip ALL currency symbols ($), percentage signs (%), and multipliers (x) — return only raw numeric values
- For calculated metrics (lpQuality, atcPurchase): calculate from the raw values if both components are visible
- If a metric is not visible or cannot be determined, return null
- Do not guess or approximate — only return values clearly visible or directly calculable
- Return ONLY a valid JSON object with no other text, explanation, or markdown

JSON format (no other text):
{"amountSpent":number|null,"cpm":number|null,"conversionValue":number|null,"roas":number|null,"cpa":number|null,"hookRate":number|null,"holdRate":number|null,"ctr":number|null,"linkClicks":number|null,"cplc":number|null,"lpv":number|null,"cplpv":number|null,"lpQuality":number|null,"atc":number|null,"initiateCheckout":number|null,"purchases":number|null,"atcPurchase":number|null}`

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

    // Strip any markdown code fences if present
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

    let values: Record<string, number | null>
    try {
      values = JSON.parse(jsonStr)
    } catch {
      return NextResponse.json(
        { error: 'Could not parse metrics from screenshot. Try a clearer screenshot or enter manually.' },
        { status: 422 }
      )
    }

    return NextResponse.json({ values })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
