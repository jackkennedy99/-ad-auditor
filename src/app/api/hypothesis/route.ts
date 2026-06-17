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
    brandContext,
    adType,
    currency,
    clientBenchmarks,
  }: {
    allScores: ScoredMetric[]
    chatContext?: string
    brandContext?: string
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

  const systemPrompt = `You are a performance creative strategist writing a bullet-point ad diagnosis.

Output format — strictly follow this:
- Each point starts with "- " (hyphen space)
- 3 to 5 bullets total
- One sentence per bullet, no sub-bullets
- No em dashes, no bold, no markdown, no headers
- Use plain commas or "but" instead of em dashes
- Reference actual metric values in each bullet
- Order: biggest problems first, root cause last`

  const userPrompt = `AD TYPE: ${adType === 'video' ? 'Video' : 'Static image'}

PERFORMANCE DATA:
${lines.join('\n')}
${benchmarksBlock}
${brandContext ? `\nBRAND / PRODUCT CONTEXT:\n${brandContext.slice(0, 800)}\n` : ''}
${chatContext ? `\nSTRATEGIST NOTES:\n${chatContext}\n` : ''}
Diagnose this ad in bullet points.`

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 400,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt },
        { role: 'assistant', content: '- ' },
      ],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    // Prepend the prefill "- " we forced, then strip any em dashes just in case
    const full = ('- ' + raw).replace(/—/g, ',').replace(/–/g, '-')
    return NextResponse.json({ hypothesis: full })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
