import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { METRICS, PLAYBOOKS, type Grade, type MetricId } from '@/lib/metrics'

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  const {
    metricId,
    metricValue,
    metricGrade,
    clientTarget,
    adType,
    transcript,
    imageBase64,
    imageMimeType,
    brandContext,
  }: {
    metricId: MetricId
    metricValue: number
    metricGrade: Grade
    clientTarget?: number
    adType: 'video' | 'static'
    transcript?: string
    imageBase64?: string
    imageMimeType?: string
    brandContext?: string
  } = await req.json()

  const config = METRICS.find((m) => m.id === metricId)
  if (!config) {
    return NextResponse.json({ error: 'Unknown metric' }, { status: 400 })
  }

  const playbook = PLAYBOOKS[metricId]
  const valueStr =
    config.unit === '$'
      ? `$${metricValue}`
      : config.unit === 'x'
      ? `${metricValue}x`
      : `${metricValue}%`
  const targetStr =
    clientTarget
      ? ` (client target: ${config.unit === '$' ? '$' : ''}${clientTarget}${config.unit === '%' ? '%' : config.unit === 'x' ? 'x' : ''})`
      : ''

  const client = new Anthropic({ apiKey })

  const systemPrompt = `You are a performance creative strategist. You write clear, direct, specific recommendations — not corporate, not generic, not salesy. You think like someone who has run hundreds of DTC paid social campaigns. You reference the actual ad content in every recommendation.`

  const userPrompt = `A Meta ad is underperforming on one metric. Analyse the ad and give specific, ready-to-test iterations.

METRIC: ${config.label} — ${valueStr}${targetStr} (${metricGrade.toUpperCase()})
CONTEXT: ${playbook.causes}

${brandContext ? `BRAND (from website):\n${brandContext}\n` : ''}
AD TYPE: ${adType === 'video' ? 'Video' : 'Static image'}
${adType === 'video' && transcript ? `TRANSCRIPT:\n${transcript}` : ''}

Give me:
CAUSE: [1–2 sentences on what specifically in THIS ad is causing ${config.label} to underperform. Reference actual content — hook wording, visuals, CTA, offer framing, etc. Not generic.]
1. [Specific iteration — one sentence briefable to an editor or creator. Reference the actual content.]
2. [Another iteration]
3. [Another iteration]

Rules:
- Reference the actual ad content in every iteration (exact words, visuals, CTA, structure)
- Each iteration = one concrete thing to change or test
- No generic advice. No filler. Short sentences.
- Don't repeat the same idea with different words.`

  try {
    let messageContent: Anthropic.MessageParam['content']

    if (adType === 'static' && imageBase64) {
      messageContent = [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: (imageMimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp') || 'image/jpeg',
            data: imageBase64,
          },
        },
        { type: 'text', text: userPrompt },
      ]
    } else {
      messageContent = userPrompt
    }

    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: messageContent }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''

    // Parse cause and iterations
    const causeMatch = text.match(/CAUSE:\s*([\s\S]+?)(?=\n\d+\.|$)/)
    const cause = causeMatch ? causeMatch[1].trim() : ''
    const iterMatches = Array.from(text.matchAll(/^\d+\.\s+(.+)$/gm))
    const iterations = iterMatches.map((m) => m[1].trim())

    return NextResponse.json({ cause, iterations })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
