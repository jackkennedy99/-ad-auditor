'use client'

import { useState, useRef, useCallback } from 'react'
import {
  METRICS,
  PLAYBOOKS,
  scoreMetric,
  isLeak,
  GRADE_LABELS,
  type MetricId,
  type Grade,
} from '@/lib/metrics'

// ─── Types ───────────────────────────────────────────────────────────────────

interface MetricEntry {
  value: string
  clientTarget: string
}

interface ScoredMetric {
  id: MetricId
  grade: Grade
  value: number
  clientTarget?: number
}

interface Recommendation {
  metricId: MetricId
  text: string
  iterations: string[]
  checked: boolean[]
}

// ─── Constants ───────────────────────────────────────────────────────────────

const GRADE_STYLES: Record<Grade, { bg: string; text: string; dot: string; border: string }> = {
  bad: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    dot: 'bg-red-400',
    border: 'border-red-200',
  },
  ok: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    dot: 'bg-amber-400',
    border: 'border-amber-200',
  },
  good: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    dot: 'bg-green-400',
    border: 'border-green-200',
  },
  great: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    border: 'border-emerald-200',
  },
}

// ─── Helper: parse AI response into per-metric sections ──────────────────────

function parseRecommendations(
  text: string,
  leaks: ScoredMetric[]
): Recommendation[] {
  const results: Recommendation[] = []

  for (const leak of leaks) {
    const config = METRICS.find((m) => m.id === leak.id)!
    // Find the section for this metric in the AI response
    const escapedLabel = config.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(
      `\\*\\*${escapedLabel}\\*\\*([\\s\\S]*?)(?=\\n\\*\\*|$)`,
      'i'
    )
    const match = text.match(regex)

    if (match) {
      const section = match[1].trim()
      // Extract numbered iterations
      const iterMatches = Array.from(section.matchAll(/^\d+\.\s+(.+)$/gm))
      const iterations = iterMatches.map((m) => m[1].trim())
      // Everything before the first numbered item is the "what's causing it" text
      const causingText = section
        .replace(/\d+\.\s+.+/g, '')
        .replace(/iterations to test[:\s]*/i, '')
        .replace(/what.s likely causing.*/i, '')
        .trim()

      results.push({
        metricId: leak.id,
        text: causingText,
        iterations,
        checked: new Array(iterations.length).fill(false),
      })
    } else {
      // Fallback: use playbook
      results.push({
        metricId: leak.id,
        text: PLAYBOOKS[leak.id].causes,
        iterations: [PLAYBOOKS[leak.id].genericFixes],
        checked: [false],
      })
    }
  }

  return results
}

// ─── Benchmark display helper ─────────────────────────────────────────────────

function BenchmarkPills({ metricId }: { metricId: MetricId }) {
  const config = METRICS.find((m) => m.id === metricId)!
  if (config.perClient || !config.thresholds) return null

  const { ok, good, great } = config.thresholds
  const u = config.unit
  const fmt = (n: number) => (u === '$' ? `$${n}` : `${n}${u}`)

  const pills =
    config.direction === 'higher'
      ? [
          { label: 'Bad', val: `<${fmt(ok)}`, grade: 'bad' as Grade },
          { label: 'OK', val: `${fmt(ok)}–${fmt(good)}`, grade: 'ok' as Grade },
          { label: 'Good', val: `${fmt(good)}–${fmt(great)}`, grade: 'good' as Grade },
          { label: 'Great', val: `>${fmt(great)}`, grade: 'great' as Grade },
        ]
      : [
          { label: 'Great', val: `<${fmt(great)}`, grade: 'great' as Grade },
          { label: 'Good', val: `${fmt(great)}–${fmt(good)}`, grade: 'good' as Grade },
          { label: 'OK', val: `${fmt(good)}–${fmt(ok)}`, grade: 'ok' as Grade },
          { label: 'Bad', val: `>${fmt(ok)}`, grade: 'bad' as Grade },
        ]

  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {pills.map((p) => (
        <span
          key={p.label}
          className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${GRADE_STYLES[p.grade].bg} ${GRADE_STYLES[p.grade].text} ${GRADE_STYLES[p.grade].border}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${GRADE_STYLES[p.grade].dot}`} />
          {p.label}: {p.val}
        </span>
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdAuditor() {
  // Metric values
  const initialEntries = Object.fromEntries(
    METRICS.map((m) => [m.id, { value: '', clientTarget: '' }])
  ) as Record<MetricId, MetricEntry>
  const [entries, setEntries] = useState<Record<MetricId, MetricEntry>>(initialEntries)

  // Scoring state
  const [scores, setScores] = useState<ScoredMetric[] | null>(null)
  const leaks = scores?.filter((s) => isLeak(s.grade)) ?? []

  // Ad content
  const [adType, setAdType] = useState<'video' | 'static'>('video')
  const [transcript, setTranscript] = useState('')
  const [brandUrl, setBrandUrl] = useState('')
  const [brandContext, setBrandContext] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [urlError, setUrlError] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Recommendations
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null)
  const [recLoading, setRecLoading] = useState(false)
  const [recError, setRecError] = useState('')

  // ── Handlers ──

  const updateEntry = (id: MetricId, field: keyof MetricEntry, val: string) => {
    setEntries((prev) => ({ ...prev, [id]: { ...prev[id], [field]: val } }))
    // Reset scores when inputs change
    setScores(null)
    setRecommendations(null)
  }

  const handleScore = () => {
    const result: ScoredMetric[] = []
    for (const config of METRICS) {
      const entry = entries[config.id]
      const val = parseFloat(entry.value)
      if (isNaN(val)) continue
      const target = parseFloat(entry.clientTarget) || undefined
      const grade = scoreMetric(config, val, target)
      result.push({ id: config.id, grade, value: val, clientTarget: target })
    }
    setScores(result)
    setRecommendations(null)
  }

  const handleScanUrl = async () => {
    if (!brandUrl.trim()) return
    setUrlLoading(true)
    setUrlError('')
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: brandUrl }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setBrandContext(data.text)
    } catch (err) {
      setUrlError(err instanceof Error ? err.message : 'Failed to scan URL')
    } finally {
      setUrlLoading(false)
    }
  }

  const handleImageChange = useCallback((file: File) => {
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (e) => setImagePreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }, [])

  const handleGenerateRecs = async () => {
    if (leaks.length === 0) return
    setRecLoading(true)
    setRecError('')

    let imageBase64: string | undefined
    let imageMimeType: string | undefined

    if (adType === 'static' && imageFile) {
      const buffer = await imageFile.arrayBuffer()
      imageBase64 = Buffer.from(buffer).toString('base64')
      imageMimeType = imageFile.type
    }

    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leaks,
          adType,
          transcript: adType === 'video' ? transcript : undefined,
          imageBase64,
          imageMimeType,
          brandContext: brandContext || undefined,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setRecommendations(parseRecommendations(data.recommendations, leaks))
    } catch (err) {
      setRecError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setRecLoading(false)
    }
  }

  const toggleIteration = (recIdx: number, iterIdx: number) => {
    setRecommendations((prev) => {
      if (!prev) return prev
      const next = [...prev]
      next[recIdx] = {
        ...next[recIdx],
        checked: next[recIdx].checked.map((c, i) => (i === iterIdx ? !c : c)),
      }
      return next
    })
  }

  const scoredCount = scores?.length ?? 0
  const leakCount = leaks.length

  // ── Render ──

  return (
    <div className="min-h-screen bg-cream-50">
      {/* Header */}
      <header className="border-b border-cream-200 bg-cream-50 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-sage-500 flex items-center justify-center">
              <svg viewBox="0 0 20 20" fill="white" className="w-4 h-4">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="font-semibold text-forest tracking-tight">Ad Auditor</span>
          </div>
          {scores && (
            <div className="flex items-center gap-2 text-sm">
              {leakCount > 0 ? (
                <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                  {leakCount} leak{leakCount !== 1 ? 's' : ''} found
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                  All metrics healthy
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-10">

        {/* ── Section 1: Metrics ── */}
        <section>
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-forest">Metrics</h2>
            <p className="text-sm text-moss mt-1">Enter this ad's performance numbers. Leave blank any metrics you don't have.</p>
          </div>

          {/* Universal metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {METRICS.filter((m) => !m.perClient).map((config) => {
              const entry = entries[config.id]
              const score = scores?.find((s) => s.id === config.id)
              const hasValue = entry.value !== ''

              return (
                <div
                  key={config.id}
                  className={`rounded-xl border p-4 transition-colors ${
                    score
                      ? isLeak(score.grade)
                        ? 'border-amber-200 bg-amber-50/40'
                        : 'border-sage-200 bg-sage-100/20'
                      : 'border-cream-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-medium text-sm text-forest">{config.label}</div>
                      <div className="text-xs text-fern mt-0.5">{config.description}</div>
                    </div>
                    {score && (
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ml-2 shrink-0 ${GRADE_STYLES[score.grade].bg} ${GRADE_STYLES[score.grade].text}`}
                      >
                        {GRADE_LABELS[score.grade]}
                      </span>
                    )}
                  </div>

                  <div className="relative">
                    {config.unit === '$' && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-moss text-sm">$</span>
                    )}
                    <input
                      type="number"
                      step="any"
                      placeholder={config.placeholder}
                      value={entry.value}
                      onChange={(e) => updateEntry(config.id, 'value', e.target.value)}
                      className={`w-full rounded-lg border text-sm px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-sage-300 focus:border-sage-400 transition-colors ${
                        config.unit === '$' ? 'pl-7' : ''
                      } ${
                        score && isLeak(score.grade)
                          ? 'border-amber-200'
                          : 'border-cream-200'
                      }`}
                    />
                    {config.unit !== '$' && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-fern text-sm pointer-events-none">
                        {config.unit}
                      </span>
                    )}
                  </div>

                  <BenchmarkPills metricId={config.id} />
                </div>
              )
            })}
          </div>

          {/* Per-client metrics */}
          <div className="rounded-xl border border-cream-200 bg-white p-5">
            <div className="text-sm font-medium text-forest mb-1">Client targets</div>
            <div className="text-xs text-fern mb-4">These metrics need your client's targets to score correctly.</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {METRICS.filter((m) => m.perClient).map((config) => {
                const entry = entries[config.id]
                const score = scores?.find((s) => s.id === config.id)

                return (
                  <div key={config.id}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="font-medium text-sm text-forest">{config.label}</div>
                        <div className="text-xs text-fern">{config.description}</div>
                      </div>
                      {score && (
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ml-2 shrink-0 ${GRADE_STYLES[score.grade].bg} ${GRADE_STYLES[score.grade].text}`}
                        >
                          {GRADE_LABELS[score.grade]}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        {config.unit === '$' && (
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-moss text-sm">$</span>
                        )}
                        <input
                          type="number"
                          step="any"
                          placeholder={`Actual${config.unit !== '$' ? ` (${config.unit})` : ''}`}
                          value={entry.value}
                          onChange={(e) => updateEntry(config.id, 'value', e.target.value)}
                          className={`w-full rounded-lg border text-sm px-3 py-2 bg-cream-50 focus:outline-none focus:ring-2 focus:ring-sage-300 focus:border-sage-400 transition-colors ${config.unit === '$' ? 'pl-7' : ''} border-cream-200`}
                        />
                      </div>
                      <div className="relative flex-1">
                        {config.unit === '$' && (
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-fern text-sm">$</span>
                        )}
                        <input
                          type="number"
                          step="any"
                          placeholder={`Target${config.unit !== '$' ? ` (${config.unit})` : ''}`}
                          value={entry.clientTarget}
                          onChange={(e) => updateEntry(config.id, 'clientTarget', e.target.value)}
                          className={`w-full rounded-lg border text-sm px-3 py-2 bg-cream-50 focus:outline-none focus:ring-2 focus:ring-sage-300 focus:border-sage-400 transition-colors ${config.unit === '$' ? 'pl-7' : ''} border-cream-200`}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <button
            onClick={handleScore}
            disabled={Object.values(entries).every((e) => e.value === '')}
            className="mt-5 px-6 py-2.5 rounded-lg bg-sage-500 text-white text-sm font-medium hover:bg-sage-600 active:bg-sage-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Score metrics
          </button>
        </section>

        {/* ── Section 2: Leak summary ── */}
        {scores && (
          <section>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-forest">
                {leakCount > 0 ? `${leakCount} leak${leakCount !== 1 ? 's' : ''} flagged` : 'No leaks — looking healthy'}
              </h2>
              {leakCount > 0 && (
                <p className="text-sm text-moss mt-1">These metrics are at OK or below and need attention.</p>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {scores.map((s) => {
                const config = METRICS.find((m) => m.id === s.id)!
                const style = GRADE_STYLES[s.grade]
                return (
                  <div
                    key={s.id}
                    className={`rounded-lg border p-3 text-center ${style.bg} ${style.border}`}
                  >
                    <div className={`text-xs font-medium ${style.text} mb-1`}>{config.label}</div>
                    <div className={`text-lg font-semibold ${style.text}`}>
                      {config.unit === '$' ? '$' : ''}{s.value}{config.unit !== '$' ? config.unit : ''}
                    </div>
                    <div className={`text-xs mt-1 font-medium ${style.text} opacity-70`}>
                      {GRADE_LABELS[s.grade]}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Section 3: Ad content + recommendations ── */}
        {scores && leakCount > 0 && (
          <section>
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-forest">Ad content</h2>
              <p className="text-sm text-moss mt-1">
                Give us the ad and optionally a brand URL — the more context, the more specific the fixes.
              </p>
            </div>

            {/* Brand URL */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-forest mb-2">
                Brand / product URL <span className="text-fern font-normal">(optional)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://brand.com"
                  value={brandUrl}
                  onChange={(e) => {
                    setBrandUrl(e.target.value)
                    setBrandContext('')
                    setUrlError('')
                  }}
                  className="flex-1 rounded-lg border border-cream-200 text-sm px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-sage-300 focus:border-sage-400"
                />
                <button
                  onClick={handleScanUrl}
                  disabled={!brandUrl.trim() || urlLoading}
                  className="px-4 py-2 rounded-lg border border-sage-300 text-sage-600 text-sm font-medium hover:bg-sage-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {urlLoading ? 'Scanning…' : 'Scan'}
                </button>
              </div>
              {urlError && <p className="text-xs text-red-600 mt-1">{urlError}</p>}
              {brandContext && !urlError && (
                <p className="text-xs text-sage-600 mt-1 flex items-center gap-1">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Site scanned — brand context loaded
                </p>
              )}
            </div>

            {/* Ad type toggle */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-forest mb-2">Ad type</label>
              <div className="inline-flex rounded-lg border border-cream-200 bg-white p-1 gap-1">
                {(['video', 'static'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setAdType(t)
                      setRecommendations(null)
                    }}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                      adType === t
                        ? 'bg-sage-500 text-white'
                        : 'text-moss hover:text-forest'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Ad content input */}
            {adType === 'video' ? (
              <div className="mb-5">
                <label className="block text-sm font-medium text-forest mb-2">
                  Script / transcript
                </label>
                <textarea
                  rows={6}
                  placeholder="Paste the full script or transcript here…"
                  value={transcript}
                  onChange={(e) => {
                    setTranscript(e.target.value)
                    setRecommendations(null)
                  }}
                  className="w-full rounded-lg border border-cream-200 text-sm px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-sage-300 focus:border-sage-400 resize-none"
                />
              </div>
            ) : (
              <div className="mb-5">
                <label className="block text-sm font-medium text-forest mb-2">
                  Upload image
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const file = e.dataTransfer.files[0]
                    if (file && file.type.startsWith('image/')) handleImageChange(file)
                  }}
                  className="rounded-xl border-2 border-dashed border-cream-300 bg-white hover:border-sage-300 hover:bg-sage-100/10 transition-colors cursor-pointer p-6 text-center"
                >
                  {imagePreview ? (
                    <div className="flex flex-col items-center gap-3">
                      <img
                        src={imagePreview}
                        alt="Ad preview"
                        className="max-h-48 rounded-lg object-contain"
                      />
                      <span className="text-xs text-fern">{imageFile?.name}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-fern">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-8 h-8 opacity-50">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm">Drop image here or click to upload</span>
                      <span className="text-xs opacity-60">PNG, JPG, WEBP</span>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleImageChange(file)
                  }}
                />
              </div>
            )}

            <button
              onClick={handleGenerateRecs}
              disabled={
                recLoading ||
                (adType === 'video' && !transcript.trim()) ||
                (adType === 'static' && !imageFile)
              }
              className="px-6 py-2.5 rounded-lg bg-sage-500 text-white text-sm font-medium hover:bg-sage-600 active:bg-sage-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {recLoading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating…
                </>
              ) : (
                'Generate iterations'
              )}
            </button>

            {recError && (
              <p className="text-sm text-red-600 mt-3">{recError}</p>
            )}
          </section>
        )}

        {/* ── Section 4: Recommendations ── */}
        {recommendations && recommendations.length > 0 && (
          <section>
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-forest">Iterations to test</h2>
              <p className="text-sm text-moss mt-1">Check off iterations as you queue them for testing.</p>
            </div>

            <div className="space-y-4">
              {recommendations.map((rec, recIdx) => {
                const config = METRICS.find((m) => m.id === rec.metricId)!
                const score = scores?.find((s) => s.id === rec.metricId)
                const checkedCount = rec.checked.filter(Boolean).length

                return (
                  <div
                    key={rec.metricId}
                    className="rounded-xl border border-cream-200 bg-white overflow-hidden"
                  >
                    {/* Header */}
                    <div className="px-5 py-4 border-b border-cream-200 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${score ? GRADE_STYLES[score.grade].bg : ''} ${score ? GRADE_STYLES[score.grade].text : ''}`}>
                          {score ? GRADE_LABELS[score.grade] : ''}
                        </span>
                        <span className="font-semibold text-forest">{config.label}</span>
                        {score && (
                          <span className="text-sm text-fern">
                            {config.unit === '$' ? '$' : ''}{score.value}{config.unit !== '$' ? config.unit : ''}
                          </span>
                        )}
                      </div>
                      {rec.iterations.length > 0 && (
                        <span className="text-xs text-fern">
                          {checkedCount}/{rec.iterations.length} queued
                        </span>
                      )}
                    </div>

                    {/* Cause */}
                    {rec.text && (
                      <div className="px-5 py-3 bg-cream-50 border-b border-cream-200">
                        <p className="text-sm text-moss leading-relaxed">{rec.text}</p>
                      </div>
                    )}

                    {/* Iterations */}
                    <div className="divide-y divide-cream-100">
                      {rec.iterations.map((iter, iterIdx) => (
                        <label
                          key={iterIdx}
                          className={`flex items-start gap-3 px-5 py-4 cursor-pointer transition-colors hover:bg-cream-50 ${
                            rec.checked[iterIdx] ? 'bg-sage-100/30' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={rec.checked[iterIdx]}
                            onChange={() => toggleIteration(recIdx, iterIdx)}
                            className="mt-0.5 w-4 h-4 rounded border-cream-300 text-sage-500 focus:ring-sage-300 shrink-0 accent-sage-500 cursor-pointer"
                          />
                          <span
                            className={`text-sm leading-relaxed transition-colors ${
                              rec.checked[iterIdx]
                                ? 'text-fern line-through'
                                : 'text-forest'
                            }`}
                          >
                            {iter}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Spacer */}
        <div className="h-16" />
      </main>
    </div>
  )
}
