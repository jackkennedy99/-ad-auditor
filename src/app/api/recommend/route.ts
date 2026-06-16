import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { METRICS, GRADE_LABELS, formatValue, isLeak, type Grade, type MetricId } from '@/lib/metrics'

type ScoredMetric = { id: MetricId; grade: Grade | null; value: number }

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
    allScores,
    adType,
    transcript,
    imageBase64,
    imageMimeType,
    brandContext,
    chatContext,
    clientBenchmarks,
    currency,
  }: {
    metricId: MetricId
    metricValue: number
    metricGrade: Grade
    clientTarget?: number
    allScores?: ScoredMetric[]
    adType: 'video' | 'static'
    transcript?: string
    imageBase64?: string
    imageMimeType?: string
    brandContext?: string
    chatContext?: string
    clientBenchmarks?: {
      breakevenCpa?: string
      accountCpa?: string
      aov?: string
      ltv?: string
      subscriberRate?: string
    }
    currency?: string
  } = await req.json()

  const cur = currency || '$'

  const config = METRICS.find((m) => m.id === metricId)
  if (!config) {
    return NextResponse.json({ error: 'Unknown metric' }, { status: 400 })
  }

  const isUnderperforming = isLeak(metricGrade)

  // Build a full picture of the ad's performance for the AI to reason from
  let fullPictureBlock = ''
  if (allScores && allScores.length > 0) {
    const lines = allScores
      .map((s) => {
        const c = METRICS.find((m) => m.id === s.id)
        if (!c) return null
        const gradeLabel = s.grade ? GRADE_LABELS[s.grade] : 'n/a'
        return `  ${c.label}: ${formatValue(c, s.value, cur)} (${gradeLabel})`
      })
      .filter(Boolean)
    fullPictureBlock = `\nFULL AD PERFORMANCE SNAPSHOT:\n${lines.join('\n')}\n`
  }

  const valueStr =
    config.unit === '$' ? `${cur}${metricValue}`
    : config.unit === 'x' ? `${metricValue}x`
    : config.unit === '%' ? `${metricValue}%`
    : `${metricValue}`

  const targetStr = clientTarget
    ? ` (client target: ${config.unit === '$' ? cur : ''}${clientTarget}${config.unit === '%' ? '%' : config.unit === 'x' ? 'x' : ''})`
    : ''

  // Build client benchmarks context block
  let benchmarksBlock = ''
  if (clientBenchmarks && Object.values(clientBenchmarks).some(Boolean)) {
    const lines = [
      clientBenchmarks.breakevenCpa ? `  Breakeven CPA: ${cur}${clientBenchmarks.breakevenCpa}` : null,
      clientBenchmarks.accountCpa ? `  Account-wide CPA: ${cur}${clientBenchmarks.accountCpa}` : null,
      clientBenchmarks.aov ? `  Average Order Value (AOV): ${cur}${clientBenchmarks.aov}` : null,
      clientBenchmarks.ltv ? `  Lifetime Value (LTV): ${cur}${clientBenchmarks.ltv}` : null,
      clientBenchmarks.subscriberRate ? `  Subscriber Conversion Rate: ${clientBenchmarks.subscriberRate}%` : null,
    ].filter(Boolean)
    benchmarksBlock = `\nCLIENT BENCHMARKS (use to contextualise performance — e.g. high LTV means a higher CPA may still be profitable):\n${lines.join('\n')}\n`
  }

  const client = new Anthropic({ apiKey })

  const systemPrompt = `You are a performance creative strategist at a DTC agency. You write clear, direct, specific recommendations — not corporate, not generic, not salesy.

CRITICAL RULE — REASON FROM THE ACTUAL DATA:
You have the full performance snapshot for this ad. When diagnosing a cause, use the actual numbers in front of you. Do NOT assume a metric is causing an issue if the data shows otherwise. For example: if CTR is 4.5% (Great) you must not suggest the problem is low CTR — find the real cause from what the numbers actually show. Cross-reference all the metrics together before concluding anything.

WHEN CLIENT BENCHMARKS ARE PROVIDED: Use them to reframe what good and bad actually means for this specific client. A CPA that looks Bad against generic benchmarks might be fine if LTV is high. A ROAS that looks Good might still be below breakeven. Always factor these in before making judgements.`

  const verb = isUnderperforming ? 'underperforming on' : 'performing well on'
  const taskLine = isUnderperforming
    ? `Diagnose the specific cause and give ready-to-test iterations to improve it.`
    : `Identify what's working and give iterations to push it even further.`

  const userPrompt = `A Meta ad is ${verb} one metric. ${taskLine}
${fullPictureBlock}${benchmarksBlock}
FOCUS METRIC: ${config.label} — ${valueStr}${targetStr} (${metricGrade.toUpperCase()})
WHAT IT MEASURES: ${config.what}
WHY IT MATTERS: ${config.why}

${brandContext ? `BRAND CONTEXT (from website):\n${brandContext}\n` : ''}
${chatContext ? `STRATEGIST NOTES:\n${chatContext}\n` : ''}
AD TYPE: ${adType === 'video' ? 'Video' : 'Static image'}
${adType === 'video' && transcript ? `TRANSCRIPT:\n${transcript}` : ''}

${isUnderperforming ? `Give me:
CAUSE: [1–2 sentences diagnosing the specific cause for THIS ad based on the actual data above — NOT blanket industry rules. Reference real content from the ad and cross-reference with the other metric values to pinpoint the real issue.]
1. [Specific iteration — one briefable sentence referencing the actual content]
2. [Another iteration]
3. [Another iteration]` : `Give me:
WHAT'S WORKING: [1–2 sentences on specifically why this metric is performing well for this ad — reference the actual creative.]
1. [Iteration to push this further or capitalise on it — one briefable sentence]
2. [Another iteration]
3. [Another iteration]`}

Rules:
- Always reason from the full data snapshot, never from isolated assumptions
- Reference the actual ad content in every iteration (exact words, visuals, CTA, structure)
- Each iteration = one concrete thing to change or test
- No filler. Short sentences.
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

    // Parse either CAUSE: or WHAT'S WORKING:
    const causeMatch = text.match(/(?:CAUSE|WHAT'S WORKING):\s*([\s\S]+?)(?=\n\d+\.|$)/)
    const cause = causeMatch ? causeMatch[1].trim() : ''
    const iterMatches = Array.from(text.matchAll(/^\d+\.\s+(.+)$/gm))
    const iterations = iterMatches.map((m) => m[1].trim())

    return NextResponse.json({ cause, iterations })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
