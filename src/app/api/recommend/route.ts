import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { METRICS, PLAYBOOKS, type Grade, type MetricId } from '@/lib/metrics'

interface LeakInput {
  id: MetricId
  value: number
  grade: Grade
  clientTarget?: number
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  const { leaks, adType, transcript, imageBase64, imageMimeType, brandContext } =
    await req.json()

  if (!leaks || leaks.length === 0) {
    return NextResponse.json({ error: 'No leaks provided' }, { status: 400 })
  }

  const client = new Anthropic({ apiKey })

  // Build leak descriptions
  const leakDescriptions = leaks
    .map((leak: LeakInput) => {
      const config = METRICS.find((m) => m.id === leak.id)!
      const playbook = PLAYBOOKS[leak.id]
      const valueStr =
        config.unit === '$'
          ? `$${leak.value}`
          : config.unit === 'x'
          ? `${leak.value}x`
          : `${leak.value}%`
      const targetStr = leak.clientTarget
        ? ` (target: ${config.unit === '$' ? '$' : ''}${leak.clientTarget}${config.unit === '%' ? '%' : config.unit === 'x' ? 'x' : ''})`
        : ''
      return `**${config.label}**: ${valueStr}${targetStr} — ${leak.grade.toUpperCase()}
  Why this leaks: ${playbook.causes}`
    })
    .join('\n\n')

  const systemPrompt = `You are a performance creative strategist. You write clear, direct, specific recommendations — not corporate, not salesy, not generic. You reference actual content. You think like someone who has worked on hundreds of DTC paid social campaigns.`

  const userPrompt = `An ad is underperforming on the following metrics. Generate specific, ready-to-test creative iterations for each leak.

${brandContext ? `BRAND CONTEXT (from their website):\n${brandContext}\n\n` : ''}AD TYPE: ${adType === 'video' ? 'Video' : 'Static image'}
${adType === 'video' && transcript ? `TRANSCRIPT:\n${transcript}` : adType === 'static' && !imageBase64 ? 'No ad content provided.' : ''}

LEAKS:
${leakDescriptions}

For each leak, write:
**[METRIC LABEL]**
What's likely causing it in this specific ad: [1–2 sentences that reference the actual ad content]
Iterations to test:
1. [Specific, concrete iteration — reference actual content: the hook line, the visual, the CTA wording, the offer framing, etc.]
2. [Another iteration]
3. [Another iteration]

Rules:
- Reference the actual ad content in every iteration — no generic advice
- Each iteration should be something you can brief to an editor or creator in one sentence
- Don't repeat the same idea with different words
- Be direct. Short sentences. No filler.`

  try {
    let messageContent: Anthropic.MessageParam['content']

    if (adType === 'static' && imageBase64) {
      messageContent = [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: imageMimeType || 'image/jpeg',
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
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: messageContent }],
    })

    const text =
      message.content[0].type === 'text' ? message.content[0].text : ''

    return NextResponse.json({ recommendations: text })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
