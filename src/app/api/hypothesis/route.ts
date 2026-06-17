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

Your job is to read a full set of Meta ad metrics and return a short bullet-point hypothesis: what's actually going wrong (or working) with this ad, and why.

Rules:
- Return 3-5 bullet points, each starting with "- "
- Each bullet is one punchy sentence — no padding
- Name specific metrics with their actual values
- Lead bullets with the biggest issues first
- Last bullet should be a root cause hypothesis
- No headers, no bold, no markdown beyond the "- " prefix
- Every bullet must be grounded in the actual numbers`

  const userPrompt = `AD TYPE: ${adType === 'video' ? 'Video' : 'Static image'}

PERFORMANCE DATA:
${lines.join('\n')}
${benchmarksBlock}
${chatContext ? `\nSTRATEGIST NOTES:\n${chatContext}\n` : ''}
Give me a bullet-point hypothesis about what's going on with this ad.`

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
