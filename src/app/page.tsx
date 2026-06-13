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

type Values = Partial<Record<MetricId, number>>
type Targets = { cpa: string; roas: string }
type ScoredMetric = { id: MetricId; grade: Grade; value: number; clientTarget?: number }
type RecState = { cause: string; iterations: string[]; checked: boolean[] }

// ─── Grade styling ────────────────────────────────────────────────────────────

const G = {
  bad:   { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     bar: 'bg-red-400',    ring: 'ring-red-300',    pill: 'bg-red-100 text-red-700'    },
  ok:    { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   bar: 'bg-amber-400',  ring: 'ring-amber-300',  pill: 'bg-amber-100 text-amber-700'  },
  good:  { bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-200',   bar: 'bg-green-400',  ring: 'ring-green-300',  pill: 'bg-green-100 text-green-700'  },
  great: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', bar: 'bg-emerald-500',ring: 'ring-emerald-300',pill: 'bg-emerald-100 text-emerald-700'},
} as const

const GRADE_BAR_WIDTH: Record<Grade, string> = {
  bad: '25%', ok: '50%', good: '75%', great: '100%',
}

function fmtValue(id: MetricId, val: number) {
  const c = METRICS.find((m) => m.id === id)!
  if (c.unit === '$') return `$${val % 1 === 0 ? val : val.toFixed(2)}`
  if (c.unit === 'x') return `${val}x`
  return `${val}%`
}

// ─── Components ──────────────────────────────────────────────────────────────

function GradePill({ grade }: { grade: Grade }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${G[grade].pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${G[grade].bar}`} />
      {GRADE_LABELS[grade]}
    </span>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdAuditor() {
  // ── Step state
  const [step, setStep] = useState<'upload' | 'dashboard'>('upload')
  const [manualMode, setManualMode] = useState(false)

  // ── Screenshot
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null)
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')
  const screenshotInputRef = useRef<HTMLInputElement>(null)

  // ── Metric values + targets
  const [values, setValues] = useState<Values>({})
  const [manualInputs, setManualInputs] = useState<Partial<Record<MetricId, string>>>({})
  const [targets, setTargets] = useState<Targets>({ cpa: '', roas: '' })
  const [scores, setScores] = useState<ScoredMetric[]>([])

  // ── Dashboard interaction
  const [expanded, setExpanded] = useState<MetricId | null>(null)

  // ── Ad content (shared)
  const [adType, setAdType] = useState<'video' | 'static'>('video')
  const [transcript, setTranscript] = useState('')
  const [adImageFile, setAdImageFile] = useState<File | null>(null)
  const [adImagePreview, setAdImagePreview] = useState<string | null>(null)
  const [brandUrl, setBrandUrl] = useState('')
  const [brandContext, setBrandContext] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [urlError, setUrlError] = useState('')
  const adImageInputRef = useRef<HTMLInputElement>(null)

  // ── Recommendations per metric
  const [recs, setRecs] = useState<Partial<Record<MetricId, RecState>>>({})
  const [recLoading, setRecLoading] = useState<Partial<Record<MetricId, boolean>>>({})
  const [recErrors, setRecErrors] = useState<Partial<Record<MetricId, string>>>({})

  // ── Scoring ───────────────────────────────────────────────────────────────

  const computeScores = useCallback((vals: Values, tgts: Targets): ScoredMetric[] => {
    return METRICS.flatMap((config) => {
      const val = vals[config.id]
      if (val === undefined || val === null) return []
      let clientTarget: number | undefined
      if (config.id === 'cpa' && tgts.cpa) clientTarget = parseFloat(tgts.cpa) || undefined
      if (config.id === 'roas' && tgts.roas) clientTarget = parseFloat(tgts.roas) || undefined
      const grade = scoreMetric(config, val, clientTarget)
      return [{ id: config.id, grade, value: val, clientTarget }]
    })
  }, [])

  const refreshScores = useCallback((vals: Values, tgts: Targets) => {
    setScores(computeScores(vals, tgts))
  }, [computeScores])

  // ── Screenshot upload & extraction ───────────────────────────────────────

  const handleScreenshot = useCallback(async (file: File) => {
    setScreenshotFile(file)
    setExtractError('')
    const preview = URL.createObjectURL(file)
    setScreenshotPreview(preview)
    setExtracting(true)

    const reader = new FileReader()
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string
      const base64 = dataUrl.split(',')[1]
      const mimeType = file.type || 'image/png'

      try {
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mimeType }),
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error)

        const extracted: Values = {}
        for (const [key, val] of Object.entries(data.values)) {
          if (val !== null && val !== undefined && !isNaN(Number(val))) {
            extracted[key as MetricId] = Number(val)
          }
        }
        setValues(extracted)
        const scored = computeScores(extracted, targets)
        setScores(scored)
        setStep('dashboard')
        setExpanded(null)
        setRecs({})
      } catch (err) {
        setExtractError(err instanceof Error ? err.message : 'Failed to read screenshot')
      } finally {
        setExtracting(false)
      }
    }
    reader.readAsDataURL(file)
  }, [targets, computeScores])

  // ── Manual entry ─────────────────────────────────────────────────────────

  const handleManualScore = () => {
    const vals: Values = {}
    for (const config of METRICS) {
      const raw = manualInputs[config.id]
      if (raw && raw.trim() !== '') {
        const n = parseFloat(raw)
        if (!isNaN(n)) vals[config.id] = n
      }
    }
    setValues(vals)
    const scored = computeScores(vals, targets)
    setScores(scored)
    setStep('dashboard')
    setExpanded(null)
    setRecs({})
  }

  // ── Target update ─────────────────────────────────────────────────────────

  const updateTarget = (key: 'cpa' | 'roas', val: string) => {
    const newTargets = { ...targets, [key]: val }
    setTargets(newTargets)
    refreshScores(values, newTargets)
  }

  // ── Brand URL scan ────────────────────────────────────────────────────────

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

  // ── Ad image upload ───────────────────────────────────────────────────────

  const handleAdImage = useCallback((file: File) => {
    setAdImageFile(file)
    const reader = new FileReader()
    reader.onload = (e) => setAdImagePreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }, [])

  // ── Generate recommendations for one metric ───────────────────────────────

  const hasAdContent = adType === 'video' ? transcript.trim().length > 0 : adImageFile !== null

  const generateRec = async (metricId: MetricId) => {
    const score = scores.find((s) => s.id === metricId)
    if (!score || !hasAdContent) return

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
          clientTarget: score.clientTarget,
          adType,
          transcript: adType === 'video' ? transcript : undefined,
          imageBase64,
          imageMimeType,
          brandContext: brandContext || undefined,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setRecs((p) => ({
        ...p,
        [metricId]: {
          cause: data.cause,
          iterations: data.iterations,
          checked: new Array(data.iterations.length).fill(false),
        },
      }))
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
      return {
        ...p,
        [metricId]: {
          ...rec,
          checked: rec.checked.map((c, i) => (i === idx ? !c : c)),
        },
      }
    })
  }

  const leaks = scores.filter((s) => isLeak(s.grade))

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAF7F2' }}>

      {/* Header */}
      <header style={{ backgroundColor: '#FAF7F2', borderBottom: '1px solid #E8DCC4' }} className="sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#5A8E5A' }}>
              <svg viewBox="0 0 20 20" fill="white" className="w-3.5 h-3.5">
                <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clipRule="evenodd" />
                <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="font-semibold tracking-tight" style={{ color: '#2D3428' }}>Ad Auditor</span>
          </div>

          {step === 'dashboard' && (
            <div className="flex items-center gap-3">
              {scores.length > 0 && (
                leaks.length > 0 ? (
                  <span className="text-sm font-medium px-3 py-1 rounded-full bg-amber-100 text-amber-700">
                    {leaks.length} leak{leaks.length !== 1 ? 's' : ''} found
                  </span>
                ) : (
                  <span className="text-sm font-medium px-3 py-1 rounded-full bg-emerald-100 text-emerald-700">
                    All healthy
                  </span>
                )
              )}
              <button
                onClick={() => {
                  setStep('upload')
                  setManualMode(false)
                  setScreenshotFile(null)
                  setScreenshotPreview(null)
                  setValues({})
                  setManualInputs({})
                  setScores([])
                  setExpanded(null)
                  setRecs({})
                  setExtractError('')
                }}
                className="text-sm px-3 py-1.5 rounded-lg border transition-colors"
                style={{ borderColor: '#C0D4C0', color: '#4A5240' }}
              >
                New audit
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">

        {/* ══════════════════════════════════════════ */}
        {/* STEP: UPLOAD                               */}
        {/* ══════════════════════════════════════════ */}
        {step === 'upload' && !manualMode && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-10">
              <h1 className="text-2xl font-semibold mb-2" style={{ color: '#2D3428' }}>
                Drop in your Ads Manager screenshot
              </h1>
              <p className="text-sm" style={{ color: '#7A8870' }}>
                Claude reads your Meta performance data and diagnoses exactly where the ad is leaking.
              </p>
            </div>

            {/* Upload zone */}
            <div
              onClick={() => !extracting && screenshotInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const file = e.dataTransfer.files[0]
                if (file && file.type.startsWith('image/')) handleScreenshot(file)
              }}
              className="rounded-2xl border-2 border-dashed cursor-pointer transition-all"
              style={{
                borderColor: extracting ? '#7AA87A' : '#C0D4C0',
                backgroundColor: extracting ? '#F0F5F0' : '#FFFFFF',
                minHeight: '320px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {extracting ? (
                <div className="flex flex-col items-center gap-4 p-10">
                  {screenshotPreview && (
                    <div className="relative">
                      <img src={screenshotPreview} alt="screenshot" className="max-h-40 rounded-lg opacity-60 object-contain" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-white rounded-xl px-4 py-3 shadow-sm flex items-center gap-2.5">
                          <Spinner />
                          <span className="text-sm font-medium" style={{ color: '#2D3428' }}>Reading your ad data…</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : screenshotPreview && extractError ? (
                <div className="flex flex-col items-center gap-4 p-10 text-center">
                  <img src={screenshotPreview} alt="screenshot" className="max-h-32 rounded-lg opacity-50 object-contain" />
                  <div>
                    <p className="text-sm font-medium text-red-600 mb-1">Couldn't read the screenshot</p>
                    <p className="text-xs text-red-500 mb-3">{extractError}</p>
                    <p className="text-xs" style={{ color: '#7A8870' }}>Try a clearer crop, or use manual entry below.</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 p-10 text-center" style={{ color: '#9DAF9D' }}>
                  <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" className="w-12 h-12 opacity-60">
                    <rect x="4" y="8" width="40" height="28" rx="3" strokeWidth="2" />
                    <path d="M4 30l10-8 8 6 8-10 14 12" strokeWidth="2" strokeLinejoin="round" />
                    <circle cx="15" cy="19" r="3" strokeWidth="2" />
                    <path d="M18 40h12M24 36v4" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <div>
                    <p className="text-base font-medium" style={{ color: '#4A5240' }}>Drop your Ads Manager screenshot here</p>
                    <p className="text-sm mt-1" style={{ color: '#9DAF9D' }}>or click to browse</p>
                  </div>
                  <p className="text-xs" style={{ color: '#B8CFB8' }}>PNG, JPG, WEBP · Make sure all 10 metric columns are visible</p>
                </div>
              )}
            </div>

            <input
              ref={screenshotInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleScreenshot(file)
              }}
            />

            <div className="text-center mt-6">
              <button
                onClick={() => setManualMode(true)}
                className="text-sm underline underline-offset-2 transition-colors"
                style={{ color: '#7A8870' }}
              >
                Enter metrics manually instead
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════ */}
        {/* MANUAL ENTRY                               */}
        {/* ══════════════════════════════════════════ */}
        {step === 'upload' && manualMode && (
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-8">
              <button onClick={() => setManualMode(false)} className="text-sm" style={{ color: '#7A8870' }}>
                ← Back
              </button>
              <h2 className="text-lg font-semibold" style={{ color: '#2D3428' }}>Enter metrics manually</h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
              {METRICS.filter((m) => !m.perClient).map((config) => (
                <div key={config.id} className="rounded-xl border p-4 bg-white" style={{ borderColor: '#E8DCC4' }}>
                  <div className="font-medium text-sm mb-0.5" style={{ color: '#2D3428' }}>{config.label}</div>
                  <div className="text-xs mb-2" style={{ color: '#9DAF9D' }}>{config.description}</div>
                  <div className="relative">
                    {config.unit === '$' && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#7A8870' }}>$</span>}
                    <input
                      type="number"
                      step="any"
                      placeholder={config.placeholder}
                      value={manualInputs[config.id] ?? ''}
                      onChange={(e) => setManualInputs((p) => ({ ...p, [config.id]: e.target.value }))}
                      className={`w-full rounded-lg border text-sm px-3 py-2 focus:outline-none focus:ring-2 transition-colors ${config.unit === '$' ? 'pl-7' : ''}`}
                      style={{ borderColor: '#E8DCC4', backgroundColor: '#FDFAF5' }}
                    />
                    {config.unit !== '$' && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none" style={{ color: '#9DAF9D' }}>{config.unit}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Per-client targets */}
            <div className="rounded-xl border p-5 bg-white mb-5" style={{ borderColor: '#E8DCC4' }}>
              <div className="text-sm font-medium mb-1" style={{ color: '#2D3428' }}>Client targets</div>
              <div className="text-xs mb-4" style={{ color: '#9DAF9D' }}>Enter actual value + your target to score CPA and ROAS.</div>
              <div className="grid grid-cols-2 gap-4">
                {(['cpa', 'roas'] as const).map((id) => {
                  const config = METRICS.find((m) => m.id === id)!
                  return (
                    <div key={id}>
                      <div className="text-sm font-medium mb-2" style={{ color: '#2D3428' }}>{config.label}</div>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          {config.unit === '$' && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#7A8870' }}>$</span>}
                          <input
                            type="number" step="any" placeholder="Actual"
                            value={manualInputs[id] ?? ''}
                            onChange={(e) => setManualInputs((p) => ({ ...p, [id]: e.target.value }))}
                            className={`w-full rounded-lg border text-sm px-3 py-2 focus:outline-none ${config.unit === '$' ? 'pl-7' : ''}`}
                            style={{ borderColor: '#E8DCC4', backgroundColor: '#FDFAF5' }}
                          />
                        </div>
                        <div className="relative flex-1">
                          {config.unit === '$' && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#9DAF9D' }}>$</span>}
                          <input
                            type="number" step="any" placeholder="Target"
                            value={targets[id]}
                            onChange={(e) => updateTarget(id, e.target.value)}
                            className={`w-full rounded-lg border text-sm px-3 py-2 focus:outline-none ${config.unit === '$' ? 'pl-7' : ''}`}
                            style={{ borderColor: '#E8DCC4', backgroundColor: '#FDFAF5' }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <button
              onClick={handleManualScore}
              disabled={Object.values(manualInputs).every((v) => !v)}
              className="px-6 py-2.5 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-40"
              style={{ backgroundColor: '#5A8E5A' }}
            >
              Score metrics
            </button>
          </div>
        )}

        {/* ══════════════════════════════════════════ */}
        {/* STEP: DASHBOARD                            */}
        {/* ══════════════════════════════════════════ */}
        {step === 'dashboard' && (
          <div>
            {/* Screenshot thumbnail */}
            {screenshotPreview && !manualMode && (
              <div className="flex items-center gap-3 mb-8 p-3 rounded-xl border" style={{ borderColor: '#E8DCC4', backgroundColor: '#FFFFFF' }}>
                <img src={screenshotPreview} alt="Ads Manager" className="h-12 rounded-lg object-contain opacity-80" />
                <div>
                  <div className="text-sm font-medium" style={{ color: '#2D3428' }}>
                    {scores.length} metric{scores.length !== 1 ? 's' : ''} read
                    {leaks.length > 0 && <span className="ml-2 text-amber-600">· {leaks.length} leak{leaks.length !== 1 ? 's' : ''}</span>}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: '#9DAF9D' }}>Click any metric below to diagnose it</div>
                </div>
              </div>
            )}

            {/* Metric grid */}
            <div className="grid grid-cols-3 gap-3 mb-3">
              {METRICS.map((config) => {
                const score = scores.find((s) => s.id === config.id)
                const isSelected = expanded === config.id
                const needsTarget = config.perClient && score && !score.clientTarget

                if (!score) {
                  // Not scored — show muted placeholder
                  return (
                    <div key={config.id} className="rounded-xl border p-4 opacity-40 cursor-default" style={{ borderColor: '#E8DCC4', backgroundColor: '#FDFAF5' }}>
                      <div className="text-xs font-medium mb-1" style={{ color: '#7A8870' }}>{config.label}</div>
                      <div className="text-sm" style={{ color: '#B8CFB8' }}>—</div>
                    </div>
                  )
                }

                return (
                  <button
                    key={config.id}
                    onClick={() => setExpanded(isSelected ? null : config.id)}
                    className={`rounded-xl border p-4 text-left transition-all ${G[score.grade].bg} ${G[score.grade].border} ${isSelected ? `ring-2 ${G[score.grade].ring}` : 'hover:shadow-sm'}`}
                  >
                    {/* Top row */}
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="text-xs font-medium mb-0.5" style={{ color: '#2D3428' }}>{config.label}</div>
                        <div className={`text-xl font-semibold ${G[score.grade].text}`}>
                          {fmtValue(config.id, score.value)}
                        </div>
                      </div>
                      <GradePill grade={score.grade} />
                    </div>

                    {/* Grade bar */}
                    <div className="h-1 rounded-full mt-3" style={{ backgroundColor: '#E8DCC4' }}>
                      <div
                        className={`h-1 rounded-full transition-all ${G[score.grade].bar}`}
                        style={{ width: GRADE_BAR_WIDTH[score.grade] }}
                      />
                    </div>

                    {/* Target warning for per-client */}
                    {needsTarget && (
                      <div className="text-xs mt-2 text-amber-600">Set target to score ↓</div>
                    )}

                    {/* Expand indicator */}
                    <div className={`text-xs mt-2 flex items-center gap-1 transition-colors ${G[score.grade].text} opacity-60`}>
                      <svg viewBox="0 0 16 16" fill="currentColor" className={`w-3 h-3 transition-transform ${isSelected ? 'rotate-180' : ''}`}>
                        <path d="M8 10.94L2.03 5 1 6.06 8 13l7-6.94L13.97 5z" />
                      </svg>
                      {isSelected ? 'Close' : 'Diagnose'}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* ── Expanded metric detail ── */}
            {expanded && (() => {
              const score = scores.find((s) => s.id === expanded)
              if (!score) return null
              const config = METRICS.find((m) => m.id === expanded)!
              const playbook = PLAYBOOKS[expanded]
              const rec = recs[expanded]
              const loading = recLoading[expanded]
              const recError = recErrors[expanded]

              return (
                <div
                  className="rounded-2xl border mb-3 overflow-hidden"
                  style={{ borderColor: '#C0D4C0', backgroundColor: '#FFFFFF' }}
                >
                  {/* Panel header */}
                  <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: '#E8DCC4', backgroundColor: '#F5F9F5' }}>
                    <div className="flex items-center gap-3">
                      <GradePill grade={score.grade} />
                      <span className="font-semibold" style={{ color: '#2D3428' }}>{config.label}</span>
                      <span className="text-sm" style={{ color: '#7A8870' }}>{fmtValue(config.id, score.value)}</span>
                    </div>
                    <button
                      onClick={() => setExpanded(null)}
                      className="w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-sage-100"
                      style={{ color: '#7A8870' }}
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>

                  <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left: playbook */}
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#9DAF9D' }}>Why this leaks</div>
                      <p className="text-sm leading-relaxed mb-4" style={{ color: '#4A5240' }}>{playbook.causes}</p>
                      <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#9DAF9D' }}>Generic fixes</div>
                      <p className="text-sm leading-relaxed" style={{ color: '#4A5240' }}>{playbook.genericFixes}</p>
                    </div>

                    {/* Right: ad content + specific recs */}
                    <div>
                      {!rec ? (
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#9DAF9D' }}>Get specific iterations</div>

                          {/* Brand URL */}
                          <div className="mb-3">
                            <div className="flex gap-2">
                              <input
                                type="url"
                                placeholder="Brand / product URL (optional)"
                                value={brandUrl}
                                onChange={(e) => { setBrandUrl(e.target.value); setBrandContext(''); setUrlError('') }}
                                className="flex-1 rounded-lg border text-sm px-3 py-2 focus:outline-none"
                                style={{ borderColor: '#E8DCC4', backgroundColor: '#FDFAF5' }}
                              />
                              <button
                                onClick={handleScanUrl}
                                disabled={!brandUrl.trim() || urlLoading}
                                className="px-3 py-2 rounded-lg border text-sm transition-colors disabled:opacity-40"
                                style={{ borderColor: '#C0D4C0', color: '#5A8E5A' }}
                              >
                                {urlLoading ? '…' : 'Scan'}
                              </button>
                            </div>
                            {urlError && <p className="text-xs text-red-500 mt-1">{urlError}</p>}
                            {brandContext && <p className="text-xs mt-1" style={{ color: '#5A8E5A' }}>✓ Brand context loaded</p>}
                          </div>

                          {/* Ad type toggle */}
                          <div className="flex rounded-lg border p-1 gap-1 mb-3 w-fit" style={{ borderColor: '#E8DCC4', backgroundColor: '#FDFAF5' }}>
                            {(['video', 'static'] as const).map((t) => (
                              <button
                                key={t}
                                onClick={() => { setAdType(t); setAdImageFile(null); setAdImagePreview(null) }}
                                className="px-3 py-1 rounded-md text-sm font-medium capitalize transition-colors"
                                style={{
                                  backgroundColor: adType === t ? '#5A8E5A' : 'transparent',
                                  color: adType === t ? 'white' : '#7A8870',
                                }}
                              >
                                {t}
                              </button>
                            ))}
                          </div>

                          {/* Ad content input */}
                          {adType === 'video' ? (
                            <textarea
                              rows={4}
                              placeholder="Paste transcript or script here…"
                              value={transcript}
                              onChange={(e) => setTranscript(e.target.value)}
                              className="w-full rounded-lg border text-sm px-3 py-2.5 focus:outline-none resize-none mb-3"
                              style={{ borderColor: '#E8DCC4', backgroundColor: '#FDFAF5' }}
                            />
                          ) : (
                            <div
                              onClick={() => adImageInputRef.current?.click()}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.preventDefault()
                                const file = e.dataTransfer.files[0]
                                if (file && file.type.startsWith('image/')) handleAdImage(file)
                              }}
                              className="rounded-lg border-2 border-dashed cursor-pointer mb-3 p-4 text-center transition-colors"
                              style={{ borderColor: adImagePreview ? '#7AA87A' : '#C0D4C0', backgroundColor: adImagePreview ? '#F0F5F0' : '#FDFAF5' }}
                            >
                              {adImagePreview ? (
                                <div className="flex items-center gap-3">
                                  <img src={adImagePreview} alt="ad" className="h-12 rounded object-contain" />
                                  <span className="text-xs" style={{ color: '#7A8870' }}>{adImageFile?.name}</span>
                                </div>
                              ) : (
                                <p className="text-sm" style={{ color: '#9DAF9D' }}>Drop ad image or click to upload</p>
                              )}
                            </div>
                          )}
                          <input ref={adImageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAdImage(f) }} />

                          {/* Per-client target inputs if needed */}
                          {config.perClient && (
                            <div className="mb-3 flex gap-2 items-center">
                              <span className="text-xs" style={{ color: '#7A8870' }}>Target {config.label}:</span>
                              <div className="relative w-28">
                                {config.unit === '$' && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#7A8870' }}>$</span>}
                                <input
                                  type="number" step="any" placeholder="e.g. 40"
                                  value={targets[config.id as 'cpa' | 'roas']}
                                  onChange={(e) => updateTarget(config.id as 'cpa' | 'roas', e.target.value)}
                                  className={`w-full rounded-lg border text-sm px-2 py-1.5 focus:outline-none ${config.unit === '$' ? 'pl-5' : ''}`}
                                  style={{ borderColor: '#E8DCC4', backgroundColor: '#FDFAF5' }}
                                />
                              </div>
                            </div>
                          )}

                          <button
                            onClick={() => generateRec(expanded)}
                            disabled={loading || !hasAdContent}
                            className="w-full px-4 py-2.5 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                            style={{ backgroundColor: '#5A8E5A' }}
                          >
                            {loading ? <><Spinner /> Analysing…</> : 'Analyse this ad'}
                          </button>
                          {!hasAdContent && (
                            <p className="text-xs text-center mt-2" style={{ color: '#9DAF9D' }}>
                              {adType === 'video' ? 'Add a transcript above to continue' : 'Upload the ad image above to continue'}
                            </p>
                          )}
                          {recError && <p className="text-sm text-red-600 mt-2">{recError}</p>}
                        </div>
                      ) : (
                        /* Recommendations output */
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#9DAF9D' }}>What's causing it</div>
                          <p className="text-sm leading-relaxed mb-4" style={{ color: '#4A5240' }}>{rec.cause}</p>
                          <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#9DAF9D' }}>Iterations to test</div>
                          <div className="space-y-2">
                            {rec.iterations.map((iter, i) => (
                              <label
                                key={i}
                                className="flex items-start gap-3 rounded-lg p-3 cursor-pointer transition-colors"
                                style={{ backgroundColor: rec.checked[i] ? '#F0F5F0' : '#FDFAF5', border: '1px solid #E8DCC4' }}
                              >
                                <input
                                  type="checkbox"
                                  checked={rec.checked[i]}
                                  onChange={() => toggleCheck(expanded, i)}
                                  className="mt-0.5 shrink-0 accent-green-600"
                                />
                                <span
                                  className="text-sm leading-relaxed"
                                  style={{ color: rec.checked[i] ? '#9DAF9D' : '#2D3428', textDecoration: rec.checked[i] ? 'line-through' : 'none' }}
                                >
                                  {iter}
                                </span>
                              </label>
                            ))}
                          </div>
                          <button
                            onClick={() => setRecs((p) => { const n = { ...p }; delete n[expanded]; return n })}
                            className="text-xs mt-3 underline underline-offset-2"
                            style={{ color: '#9DAF9D' }}
                          >
                            Re-analyse
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Per-client targets (if not already in expanded panel) */}
            {!expanded && scores.some((s) => s.id === 'cpa' || s.id === 'roas') && (
              <div className="rounded-xl border p-4 mt-2" style={{ borderColor: '#E8DCC4', backgroundColor: '#FFFFFF' }}>
                <div className="text-sm font-medium mb-3" style={{ color: '#2D3428' }}>Client targets</div>
                <div className="flex gap-6">
                  {(['cpa', 'roas'] as const).map((id) => {
                    const config = METRICS.find((m) => m.id === id)!
                    const score = scores.find((s) => s.id === id)
                    if (!score) return null
                    return (
                      <div key={id} className="flex items-center gap-2">
                        <span className="text-sm" style={{ color: '#4A5240' }}>{config.label} target:</span>
                        <div className="relative w-24">
                          {config.unit === '$' && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#7A8870' }}>$</span>}
                          <input
                            type="number" step="any" placeholder="—"
                            value={targets[id]}
                            onChange={(e) => updateTarget(id, e.target.value)}
                            className={`w-full rounded-lg border text-sm px-2 py-1.5 focus:outline-none ${config.unit === '$' ? 'pl-5' : ''}`}
                            style={{ borderColor: '#E8DCC4', backgroundColor: '#FDFAF5' }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
