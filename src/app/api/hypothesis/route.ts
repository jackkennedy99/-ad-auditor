import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { METRICS, GRADE_LABELS, formatValue, type Grade, type MetricId } from '@/lib/metrics'

type ScoredMetric = { id: MetricId; grade: Grade | null; value: number }

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 })

  const {
    allScores,
    chatContext,
    adType,
    currency,
    clientBenchmarks,
  }: {
    allScores: ScoredMetric[]
    chatContext?: string
    adType: 'video' | 'static'
    currency?: string
    clientBenchmarks?: {
      breakevenCpa?: string
      accountCpa?: string
      aov?: string
      ltv?: string
      subscriberRate?: string
    }
  } = await req.json()

  const cur = currency || '$'

  const lines = allScores
    .map((s) => {
      const c = METRICS.find((m) => m.id === s.id)
      if (!c) return null
      const gradeLabel = s.grade ? GRADE_LABELS[s.grade] : 'n/a'
      return `  ${c.label}: ${formatValue(c, s.value, cur)} (${gradeLabel})`
    })
    .filter(Boolean)

  let benchmarksBlock = ''
  if (clientBenchmarks && Object.values(clientBenchmarks).some(Boolean)) {
    const bLines = [
      clientBenchmarks.breakevenCpa ? `  Breakeven CPA: ${cur}${clientBenchmarks.breakevenCpa}` : null,
      clientBenchmarks.accountCpa ? `  Account-wide CPA: ${cur}${clientBenchmarks.accountCpa}` : null,
      clientBenchmarks.aov ? `  AOV: ${cur}${clientBenchmarks.aov}` : null,
      clientBenchmarks.ltv ? `  LTV: ${cur}${clientBenchmarks.ltv}` : null,
      clientBenchmarks.subscriberRate ? `  Subscriber Rate: ${clientBenchmarks.subscriberRate}%` : null,
    ].filter(Boolean)
    benchmarksBlock = `\nCLIENT BENCHMARKS:\n${bLines.join('\n')}\n`
  }

  const client = new Anthropic({ apiKey })

  const systemPrompt = `You are a performance creative strategist. You write direct, specific diagnoses — not corporate, not generic.

Your job is to read a full set of Meta ad metrics and write a short hypothesis: what's actually going wrong (or working) with this ad, and why.

Rules:
- Name specific metrics by their actual values, not vague descriptions
- Identify the 1-3 biggest issues or patterns in the data
- If there's a funnel leak, name exactly where it is (e.g. "strong CTR but losing 60% at ATC→IC")
- One short paragraph. 3-5 sentences max.
- No bullet points, no headers, no markdown. Just plain prose.
- Don't pad with generic advice. Every sentence must be grounded in the actual numbers.`

  const userPrompt = `AD TYPE: ${adType === 'video' ? 'Video' : 'Static image'}

PERFORMANCE DATA:
${lines.join('\n')}
${benchmarksBlock}
${chatContext ? `\nSTRATEGIST NOTES:\n${chatContext}\n` : ''}
Write a plain-English hypothesis about what's going on with this ad. Lead with what the data actually shows, then give your read on the likely root cause.`

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    return NextResponse.json({ hypothesis: text })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
