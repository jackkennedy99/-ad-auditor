import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const EXTRACTION_PROMPT = `You are reading a Meta Ads Manager screenshot showing ad performance data.

Extract these exact metrics and return them as a JSON object. Read the exact numbers shown — be precise.

Metrics to find:
1. hookRate — Hook Rate as a percentage. May be labeled "Hook Rate", "Video Hook Rate", or calculated as (3-Second Video Views / Impressions) × 100.
2. holdRate — Hold Rate as a percentage. May be labeled "Hold Rate", "Video Play Rate", "Avg. Watch Time" as % of video length, or ThruPlay Rate.
3. ctr — Link Click CTR as a percentage. Must be the LINK click CTR (not all CTR). May be labeled "CTR (Link Click-Through Rate)", "Link CTR", or "CTR (All)" if link clicks only shown.
4. cplc — Cost Per Link Click in dollars. May be labeled "CPC (Cost per Link Click)", "CPLC", "Cost per Link Click".
5. cplpv — Cost Per Landing Page View in dollars. May be labeled "Cost per Landing Page View", "CPLPV".
6. lpQuality — Landing Page Quality as a percentage = (Landing Page Views ÷ Link Clicks) × 100. If shown directly use it; otherwise calculate from the raw numbers if both are visible in the screenshot.
7. atcPurchase — Add to Cart to Purchase ratio as a percentage = (Purchases ÷ Add to Carts) × 100. Calculate from raw numbers if shown.
8. cpa — Cost Per Acquisition in dollars. May be labeled "Cost per Purchase", "CPA", "Cost per Result" (when campaign is optimised for purchases).
9. roas — Return on Ad Spend as a number. May be labeled "Purchase ROAS", "ROAS", "Return on Ad Spend". Strip any "x" suffix — return only the number.

Rules:
- Strip ALL currency symbols ($), percentage signs (%), and multipliers (x) — return only raw numeric values
- If a metric is not visible or cannot be determined from the screenshot, return null for that metric
- Do not guess or approximate — only return values clearly visible in the screenshot
- Return ONLY a valid JSON object with no other text, explanation, or markdown

JSON format (no other text):
{"hookRate":number|null,"holdRate":number|null,"ctr":number|null,"cplc":number|null,"cplpv":number|null,"lpQuality":number|null,"atcPurchase":number|null,"cpa":number|null,"roas":number|null}`

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
