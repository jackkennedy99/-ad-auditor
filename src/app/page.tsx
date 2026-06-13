'use client'

import { useState, useRef, useCallback } from 'react'
import {
  METRICS,
  KEY_METRICS,
  SOFT_METRICS,
  HARD_METRICS,
  CATEGORY_META,
  GRADE_STYLES,
  GRADE_LABELS,
  scoreMetric,
  isLeak,
  formatValue,
  type MetricId,
  type Category,
  type Grade,
  type MetricConfig,
} from '@/lib/metrics'

// ─── Types ────────────────────────────────────────────────────────────────────

type Values = Partial<Record<MetricId, number>>
type Targets = { roas: string; cpa: string }
type ScoredMetric = { id: MetricId; grade: Grade | null; value: number }
type RecState = { cause: string; iterations: string[]; checked: boolean[] }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="w-4 h-4 transition-transform duration-200"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
    >
      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  )
}

// ─── Benchmark scale ──────────────────────────────────────────────────────────

function BenchmarkScale({ config }: { config: MetricConfig }) {
  if (!config.thresholds) return null
  const { ok, good, great } = config.thresholds
  const u = config.unit
  const fmt = (n: number) => (u === '$' ? `$${n}` : `${n}${u}`)

  const grades: { grade: Grade; label: string; range: string }[] =
    config.direction === 'higher'
      ? [
          { grade: 'bad', label: 'Bad', range: `< ${fmt(ok)}` },
          { grade: 'ok', label: 'OK', range: `${fmt(ok)}–${fmt(good)}` },
          { grade: 'good', label: 'Good', range: `${fmt(good)}–${fmt(great)}` },
          { grade: 'great', label: 'Great', range: `> ${fmt(great)}` },
        ]
      : [
          { grade: 'great', label: 'Great', range: `< ${fmt(great)}` },
          { grade: 'good', label: 'Good', range: `${fmt(great)}–${fmt(good)}` },
          { grade: 'ok', label: 'OK', range: `${fmt(good)}–${fmt(ok)}` },
          { grade: 'bad', label: 'Bad', range: `> ${fmt(ok)}` },
        ]

  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#9CA3AF' }}>
        Benchmarks
      </div>
      <div className="flex gap-2">
        {grades.map((g) => (
          <div
            key={g.grade}
            className="flex-1 rounded-xl p-3 text-center"
            style={{ backgroundColor: GRADE_STYLES[g.grade].bg, border: `1px solid ${GRADE_STYLES[g.grade].border}` }}
          >
            <div className="text-xs font-bold mb-1" style={{ color: GRADE_STYLES[g.grade].text }}>
              {g.label}
            </div>
            <div className="text-xs font-medium" style={{ color: GRADE_STYLES[g.grade].text }}>
              {g.range}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Metric detail panel ──────────────────────────────────────────────────────

function MetricDetail({
  metricId,
  score,
  targets,
  onSetTarget,
  adType,
  transcript,
  adImageFile,
  adImagePreview,
  brandContext,
  onAdTypeChange,
  onTranscriptChange,
  onAdImageChange,
  rec,
  recLoading,
  recError,
  onGenerate,
  onToggleCheck,
  onReanalyse,
  adImageInputRef,
}: {
  metricId: MetricId
  score?: ScoredMetric
  targets: Targets
  onSetTarget: (k: 'roas' | 'cpa', v: string) => void
  adType: 'video' | 'static'
  transcript: string
  adImageFile: File | null
  adImagePreview: string | null
  brandContext: string
  onAdTypeChange: (t: 'video' | 'static') => void
  onTranscriptChange: (v: string) => void
  onAdImageChange: (f: File) => void
  rec?: RecState
  recLoading?: boolean
  recError?: string
  onGenerate: () => void
  onToggleCheck: (i: number) => void
  onReanalyse: () => void
  adImageInputRef: React.RefObject<HTMLInputElement>
}) {
  const config = METRICS.find((m) => m.id === metricId)!
  const hasAdContent = adType === 'video' ? transcript.trim().length > 0 : adImageFile !== null
  const grade = score?.grade

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}
    >
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center gap-3" style={{ borderColor: '#F3F4F6', backgroundColor: '#FAFAFA' }}>
        <div>
          <h3 className="font-semibold text-base" style={{ color: '#111827' }}>{config.label}</h3>
          {score && grade && (
            <span
              className="inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: GRADE_STYLES[grade].bg, color: GRADE_STYLES[grade].text }}
            >
              {GRADE_LABELS[grade]} · {formatValue(config, score.value)}
            </span>
          )}
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left: explanation + benchmarks */}
        <div className="space-y-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9CA3AF' }}>What it measures</div>
            <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>{config.what}</p>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9CA3AF' }}>Why it matters</div>
            <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>{config.why}</p>
          </div>
          {config.thresholds && <BenchmarkScale config={config} />}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9CA3AF' }}>
              {isLeak(grade ?? null) ? 'What to fix' : 'What to watch'}
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>{config.advice}</p>
          </div>
        </div>

        {/* Right: ad content + AI recommendations (only shown in audit mode with a leak) */}
        {score && grade && isLeak(grade) && (
          <div>
            {!rec ? (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#9CA3AF' }}>
                  Get specific iterations
                </div>

                {/* Ad type toggle */}
                <div
                  className="inline-flex rounded-xl border p-1 gap-1 mb-3"
                  style={{ borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}
                >
                  {(['video', 'static'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => onAdTypeChange(t)}
                      className="px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all"
                      style={{
                        backgroundColor: adType === t ? '#5A8E5A' : 'transparent',
                        color: adType === t ? '#fff' : '#6B7280',
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {adType === 'video' ? (
                  <textarea
                    rows={5}
                    placeholder="Paste the script or transcript here…"
                    value={transcript}
                    onChange={(e) => onTranscriptChange(e.target.value)}
                    className="w-full rounded-xl border text-sm px-4 py-3 focus:outline-none resize-none mb-3"
                    style={{ borderColor: '#E5E7EB', backgroundColor: '#FAFAFA' }}
                  />
                ) : (
                  <div
                    onClick={() => adImageInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      const f = e.dataTransfer.files[0]
                      if (f?.type.startsWith('image/')) onAdImageChange(f)
                    }}
                    className="rounded-xl border-2 border-dashed cursor-pointer mb-3 p-4 text-center transition-colors"
                    style={{ borderColor: adImagePreview ? '#7AA87A' : '#E5E7EB', backgroundColor: adImagePreview ? '#F0F5F0' : '#FAFAFA' }}
                  >
                    {adImagePreview ? (
                      <div className="flex items-center gap-3">
                        <img src={adImagePreview} alt="ad" className="h-14 rounded-lg object-contain" />
                        <span className="text-xs" style={{ color: '#6B7280' }}>{adImageFile?.name}</span>
                      </div>
                    ) : (
                      <p className="text-sm" style={{ color: '#9CA3AF' }}>Drop ad image or click to upload</p>
                    )}
                  </div>
                )}
                <input
                  ref={adImageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onAdImageChange(f) }}
                />

                {config.perClient && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs" style={{ color: '#6B7280' }}>Your target {config.label}:</span>
                    <div className="relative w-28">
                      {config.unit === '$' && (
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#9CA3AF' }}>$</span>
                      )}
                      <input
                        type="number" step="any" placeholder="e.g. 40"
                        value={targets[config.id as 'roas' | 'cpa']}
                        onChange={(e) => onSetTarget(config.id as 'roas' | 'cpa', e.target.value)}
                        className={`w-full rounded-lg border text-sm px-3 py-1.5 focus:outline-none ${config.unit === '$' ? 'pl-6' : ''}`}
                        style={{ borderColor: '#E5E7EB', backgroundColor: '#FAFAFA' }}
                      />
                    </div>
                  </div>
                )}

                <button
                  onClick={onGenerate}
                  disabled={recLoading || !hasAdContent}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#5A8E5A' }}
                >
                  {recLoading ? <><Spinner /> Analysing…</> : 'Analyse this ad'}
                </button>
                {!hasAdContent && (
                  <p className="text-xs text-center mt-2" style={{ color: '#9CA3AF' }}>
                    {adType === 'video' ? 'Add a transcript to continue' : 'Upload the ad image to continue'}
                  </p>
                )}
                {recError && <p className="text-sm mt-2" style={{ color: '#DC2626' }}>{recError}</p>}
              </div>
            ) : (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#9CA3AF' }}>What's causing it</div>
                <p className="text-sm leading-relaxed mb-5" style={{ color: '#374151' }}>{rec.cause}</p>
                <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#9CA3AF' }}>Iterations to test</div>
                <div className="space-y-2">
                  {rec.iterations.map((iter, i) => (
                    <label
                      key={i}
                      className="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors"
                      style={{
                        backgroundColor: rec.checked[i] ? '#F0FDF4' : '#FAFAFA',
                        border: `1px solid ${rec.checked[i] ? '#BBF7D0' : '#E5E7EB'}`,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={rec.checked[i]}
                        onChange={() => onToggleCheck(i)}
                        className="mt-0.5 shrink-0 accent-green-600"
                      />
                      <span
                        className="text-sm leading-relaxed"
                        style={{
                          color: rec.checked[i] ? '#6B7280' : '#111827',
                          textDecoration: rec.checked[i] ? 'line-through' : 'none',
                        }}
                      >
                        {iter}
                      </span>
                    </label>
                  ))}
                </div>
                <button
                  onClick={onReanalyse}
                  className="text-xs mt-3 underline underline-offset-2"
                  style={{ color: '#9CA3AF' }}
                >
                  Re-analyse
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Category pill ────────────────────────────────────────────────────────────

function CategoryPill({
  category,
  metrics,
  selected,
  onSelect,
  scores,
}: {
  category: Category
  metrics: MetricConfig[]
  selected: MetricId | null
  onSelect: (id: MetricId | null) => void
  scores?: ScoredMetric[]
}) {
  const meta = CATEGORY_META[category]

  return (
    <div>
      {/* Category label */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full"
          style={{ backgroundColor: meta.pillBg, color: meta.textColor }}
        >
          {meta.label}
        </span>
      </div>

      {/* Pill container */}
      <div
        className="rounded-3xl p-4"
        style={{ backgroundColor: meta.bg, border: `2px solid ${meta.border}` }}
      >
        <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {metrics.map((config) => {
            const score = scores?.find((s) => s.id === config.id)
            const isSelected = selected === config.id
            const grade = score?.grade ?? null

            return (
              <button
                key={config.id}
                onClick={() => onSelect(isSelected ? null : config.id)}
                className="flex flex-col items-center rounded-2xl transition-all shrink-0"
                style={{
                  minWidth: category === 'soft' ? '120px' : '140px',
                  flex: '1',
                  backgroundColor: '#FFFFFF',
                  border: isSelected ? `2px solid ${meta.accent}` : '2px solid transparent',
                  boxShadow: isSelected
                    ? `0 0 0 3px ${meta.bg}, 0 4px 12px rgba(0,0,0,0.08)`
                    : '0 1px 4px rgba(0,0,0,0.06)',
                  padding: '14px 12px 12px',
                }}
              >
                {/* Label */}
                <div
                  className="text-xs font-semibold text-center leading-tight mb-3"
                  style={{ color: '#111827', minHeight: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {config.label}
                </div>

                {/* Divider */}
                <div className="w-full mb-3" style={{ height: '1px', backgroundColor: '#F3F4F6' }} />

                {/* Value or dash */}
                <div className="mb-3 text-center" style={{ minHeight: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {score ? (
                    <div>
                      <div
                        className="text-xl font-bold"
                        style={{
                          color: grade
                            ? GRADE_STYLES[grade].text
                            : '#111827',
                        }}
                      >
                        {formatValue(config, score.value)}
                      </div>
                      {grade && (
                        <div
                          className="text-xs font-semibold mt-0.5"
                          style={{ color: GRADE_STYLES[grade].text }}
                        >
                          {GRADE_LABELS[grade]}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-2xl font-light" style={{ color: '#D1D5DB' }}>—</span>
                  )}
                </div>

                {/* Chevron button */}
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-all"
                  style={{
                    border: `2px solid ${isSelected ? meta.accent : meta.chevronBorder}`,
                    backgroundColor: isSelected ? meta.accent : 'transparent',
                    color: isSelected ? '#fff' : meta.accent,
                  }}
                >
                  <ChevronIcon open={isSelected} />
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdAuditor() {
  // ── View state
  const [view, setView] = useState<'guide' | 'audit'>('guide')
  const [selectedMetric, setSelectedMetric] = useState<MetricId | null>(null)

  // ── Audit: screenshot
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null)
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')
  const [auditStep, setAuditStep] = useState<'upload' | 'dashboard'>('upload')
  const [manualMode, setManualMode] = useState(false)
  const screenshotInputRef = useRef<HTMLInputElement>(null)

  // ── Audit: values + targets
  const [values, setValues] = useState<Values>({})
  const [manualInputs, setManualInputs] = useState<Partial<Record<MetricId, string>>>({})
  const [targets, setTargets] = useState<Targets>({ roas: '', cpa: '' })
  const [scores, setScores] = useState<ScoredMetric[]>([])

  // ── Ad content
  const [adType, setAdType] = useState<'video' | 'static'>('video')
  const [transcript, setTranscript] = useState('')
  const [adImageFile, setAdImageFile] = useState<File | null>(null)
  const [adImagePreview, setAdImagePreview] = useState<string | null>(null)
  const [brandUrl, setBrandUrl] = useState('')
  const [brandContext, setBrandContext] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const adImageInputRef = useRef<HTMLInputElement>(null)

  // ── Recommendations
  const [recs, setRecs] = useState<Partial<Record<MetricId, RecState>>>({})
  const [recLoading, setRecLoading] = useState<Partial<Record<MetricId, boolean>>>({})
  const [recErrors, setRecErrors] = useState<Partial<Record<MetricId, string>>>({})

  // ── Scoring ────────────────────────────────────────────────────────────────

  const computeScores = useCallback((vals: Values, tgts: Targets): ScoredMetric[] => {
    return METRICS.flatMap((config) => {
      const val = vals[config.id]
      if (val === undefined || val === null) return []
      let clientTarget: number | undefined
      if (config.id === 'roas' && tgts.roas) clientTarget = parseFloat(tgts.roas) || undefined
      if (config.id === 'cpa' && tgts.cpa) clientTarget = parseFloat(tgts.cpa) || undefined
      const grade = scoreMetric(config, val, clientTarget)
      return [{ id: config.id, grade, value: val }]
    })
  }, [])

  const refreshScores = useCallback((vals: Values, tgts: Targets) => {
    setScores(computeScores(vals, tgts))
  }, [computeScores])

  // ── Screenshot upload ──────────────────────────────────────────────────────

  const handleScreenshot = useCallback(async (file: File) => {
    setScreenshotFile(file)
    setExtractError('')
    setScreenshotPreview(URL.createObjectURL(file))
    setExtracting(true)

    const reader = new FileReader()
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string
      const base64 = dataUrl.split(',')[1]
      try {
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mimeType: file.type || 'image/png' }),
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        const extracted: Values = {}
        for (const [k, v] of Object.entries(data.values)) {
          if (v !== null && v !== undefined && !isNaN(Number(v))) extracted[k as MetricId] = Number(v)
        }
        setValues(extracted)
        setScores(computeScores(extracted, targets))
        setAuditStep('dashboard')
        setSelectedMetric(null)
        setRecs({})
      } catch (err) {
        setExtractError(err instanceof Error ? err.message : 'Failed to read screenshot')
      } finally {
        setExtracting(false)
      }
    }
    reader.readAsDataURL(file)
  }, [targets, computeScores])

  // ── Manual entry ───────────────────────────────────────────────────────────

  const handleManualScore = () => {
    const vals: Values = {}
    for (const config of METRICS) {
      const raw = manualInputs[config.id]
      if (raw?.trim()) {
        const n = parseFloat(raw)
        if (!isNaN(n)) vals[config.id] = n
      }
    }
    setValues(vals)
    setScores(computeScores(vals, targets))
    setAuditStep('dashboard')
    setSelectedMetric(null)
    setRecs({})
  }

  const updateTarget = (key: 'roas' | 'cpa', val: string) => {
    const t = { ...targets, [key]: val }
    setTargets(t)
    refreshScores(values, t)
  }

  // ── Brand URL scan ─────────────────────────────────────────────────────────

  const handleScanUrl = async () => {
    if (!brandUrl.trim()) return
    setUrlLoading(true)
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: brandUrl }),
      })
      const data = await res.json()
      if (!data.error) setBrandContext(data.text)
    } finally {
      setUrlLoading(false)
    }
  }

  // ── Generate recommendations ───────────────────────────────────────────────

  const generateRec = async (metricId: MetricId) => {
    const score = scores.find((s) => s.id === metricId)
    if (!score?.grade) return
    setRecLoading((p) => ({ ...p, [metricId]: true }))
    setRecErrors((p) => ({ ...p, [metricId]: '' }))

    let imageBase64: string | undefined
    let imageMimeType: string | undefined
    if (adType === 'static' && adImageFile) {
      const buf = await adImageFile.arrayBuffer()
      imageBase64 = Buffer.from(buf).toString('base64')
      imageMimeType = adImageFile.type
    }

    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metricId,
          metricValue: score.value,
          metricGrade: score.grade,
          clientTarget: metricId === 'roas' ? parseFloat(targets.roas) || undefined : metricId === 'cpa' ? parseFloat(targets.cpa) || undefined : undefined,
          adType,
          transcript: adType === 'video' ? transcript : undefined,
          imageBase64,
          imageMimeType,
          brandContext: brandContext || undefined,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setRecs((p) => ({ ...p, [metricId]: { cause: data.cause, iterations: data.iterations, checked: new Array(data.iterations.length).fill(false) } }))
    } catch (err) {
      setRecErrors((p) => ({ ...p, [metricId]: err instanceof Error ? err.message : 'Something went wrong' }))
    } finally {
      setRecLoading((p) => ({ ...p, [metricId]: false }))
    }
  }

  const toggleCheck = (metricId: MetricId, idx: number) => {
    setRecs((p) => {
      const rec = p[metricId]
      if (!rec) return p
      return { ...p, [metricId]: { ...rec, checked: rec.checked.map((c, i) => (i === idx ? !c : c)) } }
    })
  }

  const leaks = scores.filter((s) => s.grade && isLeak(s.grade))

  // ── Selected metric detail props ───────────────────────────────────────────

  const detailProps = selectedMetric
    ? {
        metricId: selectedMetric,
        score: scores.find((s) => s.id === selectedMetric),
        targets,
        onSetTarget: updateTarget,
        adType,
        transcript,
        adImageFile,
        adImagePreview,
        brandContext,
        onAdTypeChange: (t: 'video' | 'static') => { setAdType(t); setAdImageFile(null); setAdImagePreview(null) },
        onTranscriptChange: setTranscript,
        onAdImageChange: (f: File) => {
          setAdImageFile(f)
          const r = new FileReader()
          r.onload = (e) => setAdImagePreview(e.target?.result as string)
          r.readAsDataURL(f)
        },
        rec: recs[selectedMetric],
        recLoading: recLoading[selectedMetric],
        recError: recErrors[selectedMetric],
        onGenerate: () => generateRec(selectedMetric),
        onToggleCheck: (i: number) => toggleCheck(selectedMetric, i),
        onReanalyse: () => setRecs((p) => { const n = { ...p }; delete n[selectedMetric]; return n }),
        adImageInputRef,
      }
    : null

  const selectedCategory = selectedMetric ? METRICS.find((m) => m.id === selectedMetric)?.category : null

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAF7F2' }}>

      {/* Header */}
      <header
        className="sticky top-0 z-20"
        style={{ backgroundColor: '#FAF7F2', borderBottom: '1px solid #E8DCC4' }}
      >
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#5A8E5A' }}>
              <svg viewBox="0 0 20 20" fill="white" className="w-3.5 h-3.5">
                <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clipRule="evenodd" />
                <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="font-semibold tracking-tight" style={{ color: '#2D3428' }}>Ad Auditor</span>
          </div>

          <div className="flex items-center gap-3">
            {view === 'guide' && (
              <button
                onClick={() => { setView('audit'); setAuditStep('upload'); setSelectedMetric(null) }}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                style={{ backgroundColor: '#5A8E5A' }}
              >
                Audit Ad
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
            {view === 'audit' && (
              <div className="flex items-center gap-3">
                {auditStep === 'dashboard' && leaks.length > 0 && (
                  <span className="text-sm font-medium px-3 py-1 rounded-full bg-amber-100 text-amber-700">
                    {leaks.length} leak{leaks.length !== 1 ? 's' : ''}
                  </span>
                )}
                <button
                  onClick={() => setView('guide')}
                  className="text-sm px-3 py-1.5 rounded-lg border transition-colors"
                  style={{ borderColor: '#C0D4C0', color: '#4A5240' }}
                >
                  ← Guide
                </button>
                {auditStep === 'dashboard' && (
                  <button
                    onClick={() => { setAuditStep('upload'); setManualMode(false); setScreenshotFile(null); setScreenshotPreview(null); setValues({}); setManualInputs({}); setScores([]); setSelectedMetric(null); setRecs({}) }}
                    className="text-sm px-3 py-1.5 rounded-lg border transition-colors"
                    style={{ borderColor: '#C0D4C0', color: '#4A5240' }}
                  >
                    New audit
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">

        {/* ════════════════════════════════════════════════════ */}
        {/* GUIDE VIEW                                          */}
        {/* ════════════════════════════════════════════════════ */}
        {view === 'guide' && (
          <div>
            <div className="mb-10">
              <h1 className="text-2xl font-semibold mb-2" style={{ color: '#2D3428' }}>The Ad Metrics Guide</h1>
              <p className="text-sm" style={{ color: '#7A8870' }}>
                Every metric that matters — what it means, why it matters, and what to do when it's off. Click any tile to expand.
              </p>
            </div>

            <div className="space-y-6">
              {/* KEY */}
              <CategoryPill
                category="key"
                metrics={KEY_METRICS}
                selected={selectedMetric}
                onSelect={(id) => setSelectedMetric(id)}
                scores={scores}
              />
              {selectedMetric && selectedCategory === 'key' && detailProps && (
                <MetricDetail {...detailProps} />
              )}

              {/* SOFT */}
              <CategoryPill
                category="soft"
                metrics={SOFT_METRICS}
                selected={selectedMetric}
                onSelect={(id) => setSelectedMetric(id)}
                scores={scores}
              />
              {selectedMetric && selectedCategory === 'soft' && detailProps && (
                <MetricDetail {...detailProps} />
              )}

              {/* HARD */}
              <CategoryPill
                category="hard"
                metrics={HARD_METRICS}
                selected={selectedMetric}
                onSelect={(id) => setSelectedMetric(id)}
                scores={scores}
              />
              {selectedMetric && selectedCategory === 'hard' && detailProps && (
                <MetricDetail {...detailProps} />
              )}
            </div>

            {/* CTA */}
            <div className="mt-12 text-center">
              <button
                onClick={() => { setView('audit'); setAuditStep('upload') }}
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl text-sm font-semibold text-white transition-all hover:opacity-90"
                style={{ backgroundColor: '#5A8E5A', boxShadow: '0 4px 16px rgba(90,142,90,0.3)' }}
              >
                Audit an ad
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
              <p className="text-xs mt-3" style={{ color: '#9DAF9D' }}>Upload a Meta Ads Manager screenshot and we'll diagnose it</p>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════ */}
        {/* AUDIT: UPLOAD                                       */}
        {/* ════════════════════════════════════════════════════ */}
        {view === 'audit' && auditStep === 'upload' && !manualMode && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-10">
              <h1 className="text-2xl font-semibold mb-2" style={{ color: '#2D3428' }}>Drop in your Ads Manager screenshot</h1>
              <p className="text-sm" style={{ color: '#7A8870' }}>Claude reads your Meta performance data and scores every metric automatically.</p>
            </div>

            <div
              onClick={() => !extracting && screenshotInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith('image/')) handleScreenshot(f) }}
              className="rounded-3xl border-2 border-dashed cursor-pointer transition-all"
              style={{ borderColor: extracting ? '#7AA87A' : '#C0D4C0', backgroundColor: extracting ? '#F0F5F0' : '#FFFFFF', minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {extracting ? (
                <div className="flex flex-col items-center gap-4 p-10">
                  {screenshotPreview && <img src={screenshotPreview} alt="" className="max-h-36 rounded-xl opacity-50 object-contain" />}
                  <div className="bg-white rounded-2xl px-5 py-3 shadow-sm flex items-center gap-3">
                    <Spinner />
                    <span className="text-sm font-medium" style={{ color: '#2D3428' }}>Reading your ad data…</span>
                  </div>
                </div>
              ) : extractError ? (
                <div className="flex flex-col items-center gap-3 p-10 text-center">
                  {screenshotPreview && <img src={screenshotPreview} alt="" className="max-h-28 rounded-xl opacity-40 object-contain" />}
                  <p className="text-sm font-medium text-red-600">{extractError}</p>
                  <p className="text-xs" style={{ color: '#9DAF9D' }}>Try a clearer crop, or enter manually below.</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 p-10 text-center">
                  <svg viewBox="0 0 48 48" fill="none" stroke="#C0D4C0" className="w-12 h-12">
                    <rect x="4" y="8" width="40" height="28" rx="3" strokeWidth="2" />
                    <path d="M4 30l10-8 8 6 8-10 14 12" strokeWidth="2" strokeLinejoin="round" />
                    <circle cx="15" cy="19" r="3" strokeWidth="2" />
                    <path d="M18 40h12M24 36v4" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <div>
                    <p className="font-medium" style={{ color: '#4A5240' }}>Drop your Ads Manager screenshot here</p>
                    <p className="text-sm mt-1" style={{ color: '#B8CFB8' }}>or click to browse · PNG, JPG, WEBP</p>
                  </div>
                  <p className="text-xs" style={{ color: '#C0D4C0' }}>Make sure all metric columns are visible in the screenshot</p>
                </div>
              )}
            </div>
            <input ref={screenshotInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleScreenshot(f) }} />

            <div className="text-center mt-6">
              <button onClick={() => setManualMode(true)} className="text-sm underline underline-offset-2" style={{ color: '#9DAF9D' }}>
                Enter metrics manually instead
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════ */}
        {/* AUDIT: MANUAL ENTRY                                 */}
        {/* ════════════════════════════════════════════════════ */}
        {view === 'audit' && auditStep === 'upload' && manualMode && (
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-8">
              <button onClick={() => setManualMode(false)} className="text-sm" style={{ color: '#7A8870' }}>← Back</button>
              <h2 className="text-lg font-semibold" style={{ color: '#2D3428' }}>Enter metrics manually</h2>
            </div>

            {/* Brand URL */}
            <div className="rounded-2xl border p-4 bg-white mb-5 flex gap-2 items-center" style={{ borderColor: '#E8DCC4' }}>
              <input
                type="url" placeholder="Brand / product URL for context (optional)"
                value={brandUrl} onChange={(e) => setBrandUrl(e.target.value)}
                className="flex-1 text-sm px-3 py-2 rounded-lg border focus:outline-none"
                style={{ borderColor: '#E8DCC4', backgroundColor: '#FAFAFA' }}
              />
              <button onClick={handleScanUrl} disabled={!brandUrl.trim() || urlLoading} className="px-4 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-40" style={{ borderColor: '#C0D4C0', color: '#5A8E5A' }}>
                {urlLoading ? '…' : 'Scan'}
              </button>
              {brandContext && <span className="text-xs" style={{ color: '#5A8E5A' }}>✓</span>}
            </div>

            {(['key', 'soft', 'hard'] as Category[]).map((cat) => {
              const catMetrics = METRICS.filter((m) => m.category === cat)
              const meta = CATEGORY_META[cat]
              return (
                <div key={cat} className="rounded-2xl p-4 mb-4" style={{ backgroundColor: meta.bg, border: `2px solid ${meta.border}` }}>
                  <div className="text-xs font-bold uppercase tracking-widest mb-3 px-1" style={{ color: meta.textColor }}>{meta.label}</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {catMetrics.map((config) => (
                      <div key={config.id} className="rounded-xl bg-white p-3" style={{ border: '1px solid #F3F4F6' }}>
                        <div className="text-xs font-semibold mb-2" style={{ color: '#374151' }}>{config.label}</div>
                        <div className="relative">
                          {config.unit === '$' && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#9CA3AF' }}>$</span>}
                          <input
                            type="number" step="any" placeholder={config.unit === '#' ? '0' : config.unit === 'x' ? '3.5' : config.unit === '$' ? '0.00' : '0'}
                            value={manualInputs[config.id] ?? ''}
                            onChange={(e) => setManualInputs((p) => ({ ...p, [config.id]: e.target.value }))}
                            className={`w-full rounded-lg border text-sm px-3 py-2 focus:outline-none ${config.unit === '$' ? 'pl-6' : ''}`}
                            style={{ borderColor: '#E5E7EB', backgroundColor: '#FAFAFA' }}
                          />
                          {config.unit !== '$' && config.unit !== '#' && (
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: '#9CA3AF' }}>{config.unit}</span>
                          )}
                        </div>
                        {config.perClient && (
                          <div className="mt-2">
                            <div className="relative">
                              {config.unit === '$' && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#9CA3AF' }}>$</span>}
                              <input
                                type="number" step="any" placeholder="Target"
                                value={targets[config.id as 'roas' | 'cpa']}
                                onChange={(e) => updateTarget(config.id as 'roas' | 'cpa', e.target.value)}
                                className={`w-full rounded-lg border text-xs px-3 py-1.5 focus:outline-none ${config.unit === '$' ? 'pl-6' : ''}`}
                                style={{ borderColor: '#E5E7EB', backgroundColor: '#FFFBEB' }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}

            <button
              onClick={handleManualScore}
              disabled={Object.values(manualInputs).every((v) => !v)}
              className="px-8 py-3 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-40"
              style={{ backgroundColor: '#5A8E5A' }}
            >
              Score metrics
            </button>
          </div>
        )}

        {/* ════════════════════════════════════════════════════ */}
        {/* AUDIT: DASHBOARD                                    */}
        {/* ════════════════════════════════════════════════════ */}
        {view === 'audit' && auditStep === 'dashboard' && (
          <div>
            {/* Screenshot thumb */}
            {screenshotPreview && (
              <div className="flex items-center gap-3 mb-8 p-3 rounded-2xl border bg-white" style={{ borderColor: '#E8DCC4' }}>
                <img src={screenshotPreview} alt="" className="h-10 rounded-lg object-contain opacity-80" />
                <div>
                  <div className="text-sm font-medium" style={{ color: '#2D3428' }}>
                    {scores.length} metric{scores.length !== 1 ? 's' : ''} read
                    {leaks.length > 0 && <span className="ml-2 text-amber-600">· {leaks.length} leak{leaks.length !== 1 ? 's' : ''}</span>}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: '#9DAF9D' }}>Click any tile to diagnose</div>
                </div>
                {/* Brand URL in audit dashboard */}
                <div className="ml-auto flex gap-2">
                  <input
                    type="url" placeholder="Brand URL (optional)"
                    value={brandUrl} onChange={(e) => setBrandUrl(e.target.value)}
                    className="text-xs px-3 py-1.5 rounded-lg border focus:outline-none w-48"
                    style={{ borderColor: '#E8DCC4', backgroundColor: '#FAFAFA' }}
                  />
                  <button onClick={handleScanUrl} disabled={!brandUrl.trim() || urlLoading} className="text-xs px-3 py-1.5 rounded-lg border disabled:opacity-40" style={{ borderColor: '#C0D4C0', color: '#5A8E5A' }}>
                    {urlLoading ? '…' : brandContext ? '✓ Scanned' : 'Scan'}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-6">
              {/* KEY */}
              <CategoryPill category="key" metrics={KEY_METRICS} selected={selectedMetric} onSelect={setSelectedMetric} scores={scores} />
              {selectedMetric && selectedCategory === 'key' && detailProps && <MetricDetail {...detailProps} />}

              {/* SOFT */}
              <CategoryPill category="soft" metrics={SOFT_METRICS} selected={selectedMetric} onSelect={setSelectedMetric} scores={scores} />
              {selectedMetric && selectedCategory === 'soft' && detailProps && <MetricDetail {...detailProps} />}

              {/* HARD */}
              <CategoryPill category="hard" metrics={HARD_METRICS} selected={selectedMetric} onSelect={setSelectedMetric} scores={scores} />
              {selectedMetric && selectedCategory === 'hard' && detailProps && <MetricDetail {...detailProps} />}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
