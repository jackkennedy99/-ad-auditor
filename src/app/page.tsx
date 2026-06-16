'use client'

import { useState, useRef, useCallback } from 'react'
import {
  METRICS,
  KEY_METRICS,
  SOFT_METRICS,
  HARD_METRICS,
  FUNNEL_METRICS,
  CATEGORY_META,
  GRADE_STYLES,
  GRADE_LABELS,
  scoreMetric,
  isLeak,
  formatValue,
  deriveFunnelRates,
  type MetricId,
  type Category,
  type Grade,
  type MetricConfig,
} from '@/lib/metrics'

// ─── Metric icons ─────────────────────────────────────────────────────────────

const METRIC_ICONS: Record<MetricId, JSX.Element> = {
  amountSpent: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
    </svg>
  ),
  cpm: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
    </svg>
  ),
  conversionValue: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
    </svg>
  ),
  roas: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
    </svg>
  ),
  cpa: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  ),
  hookRate: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
    </svg>
  ),
  holdRate: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
    </svg>
  ),
  ctr: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M6.672 1.911a1 1 0 10-1.932.518l.259.966a1 1 0 001.932-.518l-.26-.966zM2.429 4.74a1 1 0 10-.517 1.932l.966.259a1 1 0 00.517-1.932l-.966-.26zm8.814-.569a1 1 0 00-1.415-1.414l-.707.707a1 1 0 101.415 1.415l.707-.708zm-7.071 7.072l.707-.707A1 1 0 003.465 9.12l-.708.707a1 1 0 001.415 1.415zm3.2-5.171a1 1 0 00-1.3 1.3l4 10a1 1 0 001.823.075l1.38-2.759 3.018 3.02a1 1 0 001.414-1.415l-3.019-3.02 2.76-1.379a1 1 0 00-.076-1.822l-10-4z" clipRule="evenodd" />
    </svg>
  ),
  linkClicks: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
    </svg>
  ),
  cplc: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
    </svg>
  ),
  lpv: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
    </svg>
  ),
  cplpv: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
    </svg>
  ),
  atc: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
    </svg>
  ),
  initiateCheckout: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
      <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
    </svg>
  ),
  purchases: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
    </svg>
  ),
  atcPurchase: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
    </svg>
  ),
  // Funnel rates
  lpQuality: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11 4a1 1 0 10-2 0v4a1 1 0 102 0V7zm-3 1a1 1 0 10-2 0v3a1 1 0 102 0V8zM8 9a1 1 0 00-2 0v2a1 1 0 102 0V9z" clipRule="evenodd" />
    </svg>
  ),
  atcIc: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3z" />
      <path d="M11 17a1 1 0 100-2 1 1 0 000 2zM7 17a1 1 0 100-2 1 1 0 000 2z" />
    </svg>
  ),
  icPurchase: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
      <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
    </svg>
  ),
  lpvPurchase: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M5 2a2 2 0 00-2 2v14l3.5-2 3.5 2 3.5-2 3.5 2V4a2 2 0 00-2-2H5zm4.707 3.707a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L8.414 9H10a3 3 0 013 3 1 1 0 102 0 5 5 0 00-5-5H8.414l1.293-1.293z" clipRule="evenodd" />
    </svg>
  ),
}

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
  videoUrl,
  onVideoUrlChange,
  onTranscribe,
  transcribing,
  transcribeError,
  rec,
  recLoading,
  recError,
  onGenerate,
  onToggleCheck,
  onReanalyse,
  adImageInputRef,
  currency,
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
  videoUrl: string
  onVideoUrlChange: (v: string) => void
  onTranscribe: () => void
  transcribing: boolean
  transcribeError: string
  rec?: RecState
  recLoading?: boolean
  recError?: string
  onGenerate: () => void
  onToggleCheck: (i: number) => void
  onReanalyse: () => void
  adImageInputRef: React.RefObject<HTMLInputElement>
  currency: string
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
              {GRADE_LABELS[grade]} · {formatValue(config, score.value, currency)}
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

        {/* Right: ad content + AI recommendations (shown whenever there's a scored value) */}
        {score && grade && (
          <div>
            {!rec ? (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#9CA3AF' }}>
                  {isLeak(grade) ? 'Diagnose & iterate' : 'Push it further'}
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
                  <div className="mb-3">
                    {/* URL transcription input */}
                    <div
                      className="flex gap-2 mb-2 p-2 rounded-xl"
                      style={{ backgroundColor: '#F0F5F0', border: '1px solid #C0D4C0' }}
                    >
                      <input
                        type="url"
                        placeholder="Paste video URL to auto-transcribe…"
                        value={videoUrl}
                        onChange={(e) => onVideoUrlChange(e.target.value)}
                        className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border-0 focus:outline-none bg-transparent"
                        style={{ color: '#2D3428' }}
                        onKeyDown={(e) => { if (e.key === 'Enter' && videoUrl.trim()) onTranscribe() }}
                      />
                      <button
                        onClick={onTranscribe}
                        disabled={!videoUrl.trim() || transcribing}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40 transition-all"
                        style={{ backgroundColor: '#5A8E5A' }}
                      >
                        {transcribing ? <><Spinner /> Transcribing…</> : (
                          <>
                            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                              <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                            </svg>
                            Transcribe
                          </>
                        )}
                      </button>
                    </div>
                    {transcribeError && (
                      <p className="text-xs mb-2" style={{ color: '#DC2626' }}>{transcribeError}</p>
                    )}

                    {/* Transcript textarea */}
                    <textarea
                      rows={transcript ? 5 : 3}
                      placeholder={transcribing ? 'Transcribing…' : 'Transcript will appear here, or paste it manually'}
                      value={transcript}
                      onChange={(e) => onTranscriptChange(e.target.value)}
                      className="w-full rounded-xl border text-sm px-4 py-3 focus:outline-none resize-none"
                      style={{
                        borderColor: transcript ? '#C0D4C0' : '#E5E7EB',
                        backgroundColor: transcript ? '#F0F5F0' : '#FAFAFA',
                      }}
                    />
                  </div>
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
                  {recLoading ? <><Spinner /> Analysing…</> : isLeak(grade) ? 'Diagnose this metric' : 'Find opportunities'}
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
                <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#9CA3AF' }}>{isLeak(grade) ? "What's causing it" : "What's working"}</div>
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
  editingTile,
  editingValue,
  onStartEdit,
  onEditValueChange,
  onCommitEdit,
  onCancelEdit,
  currency = '$',
}: {
  category: Category
  metrics: MetricConfig[]
  selected: MetricId | null
  onSelect: (id: MetricId | null) => void
  scores?: ScoredMetric[]
  editingTile?: MetricId | null
  editingValue?: string
  onStartEdit?: (id: MetricId, value: number) => void
  onEditValueChange?: (v: string) => void
  onCommitEdit?: () => void
  onCancelEdit?: () => void
  currency?: string
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
                {/* Icon */}
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center mb-2.5"
                  style={{ backgroundColor: meta.pillBg, color: meta.accent }}
                >
                  {METRIC_ICONS[config.id]}
                </div>

                {/* Label */}
                <div
                  className="text-xs font-semibold text-center leading-tight mb-3"
                  style={{ color: '#111827', minHeight: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {config.label}
                </div>

                {/* Divider — only shown when there's a value */}
                {score && <div className="w-full mb-3" style={{ height: '1px', backgroundColor: '#F3F4F6' }} />}

                {/* Value — only shown when data exists */}
                {score && (
                  <div className="mb-3 text-center w-full">
                    {editingTile === config.id && onStartEdit ? (
                      /* ── Inline edit mode ── */
                      <div
                        className="flex items-center gap-1 justify-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          autoFocus
                          type="number"
                          value={editingValue}
                          onChange={(e) => onEditValueChange?.(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') onCommitEdit?.()
                            if (e.key === 'Escape') onCancelEdit?.()
                          }}
                          className="w-16 text-center text-sm font-bold rounded-md border px-1 py-0.5 focus:outline-none"
                          style={{ borderColor: meta.accent, color: meta.accent }}
                        />
                        <button
                          onClick={() => onCommitEdit?.()}
                          className="w-5 h-5 rounded flex items-center justify-center text-white text-xs"
                          style={{ backgroundColor: meta.accent }}
                          title="Confirm"
                        >✓</button>
                        <button
                          onClick={() => onCancelEdit?.()}
                          className="w-5 h-5 rounded flex items-center justify-center text-xs"
                          style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}
                          title="Cancel"
                        >✕</button>
                      </div>
                    ) : (
                      /* ── Normal display ── */
                      <div
                        className="group relative cursor-pointer"
                        onClick={(e) => { if (onStartEdit) { e.stopPropagation(); onStartEdit(config.id, score.value) } }}
                        title={onStartEdit ? 'Click to correct this value' : undefined}
                      >
                        <div
                          className="text-xl font-bold"
                          style={{ color: grade ? GRADE_STYLES[grade].text : '#111827' }}
                        >
                          {formatValue(config, score.value, currency)}
                        </div>
                        {grade && (
                          <div className="text-xs font-semibold mt-0.5" style={{ color: GRADE_STYLES[grade].text }}>
                            {GRADE_LABELS[grade]}
                          </div>
                        )}
                        {onStartEdit && (
                          <div
                            className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ backgroundColor: meta.accent }}
                          >
                            <svg viewBox="0 0 12 12" fill="white" className="w-2.5 h-2.5">
                              <path d="M8.586 1.414a2 2 0 112.828 2.828L4.828 10.828 1 11l.172-3.828L8.586 1.414z"/>
                            </svg>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

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
  const [currency, setCurrency] = useState<'$' | '£'>('$')

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
  const [videoUrl, setVideoUrl] = useState('')
  const [transcribing, setTranscribing] = useState(false)
  const [transcribeError, setTranscribeError] = useState('')
  const adImageInputRef = useRef<HTMLInputElement>(null)

  // ── Task 18: Strategist context
  const [chatContext, setChatContext] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [contextOpen, setContextOpen] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  // ── Task 17: Client benchmarks
  const [benchmarks, setBenchmarks] = useState({
    breakevenCpa: '',
    accountCpa: '',
    aov: '',
    ltv: '',
    subscriberRate: '',
  })
  const [benchmarksOpen, setBenchmarksOpen] = useState(false)

  // ── Recommendations
  const [recs, setRecs] = useState<Partial<Record<MetricId, RecState>>>({})
  const [recLoading, setRecLoading] = useState<Partial<Record<MetricId, boolean>>>({})
  const [recErrors, setRecErrors] = useState<Partial<Record<MetricId, string>>>({})

  // ── Tile override (inline edit)
  const [editingTile, setEditingTile] = useState<MetricId | null>(null)
  const [editingValue, setEditingValue] = useState('')

  // ── Currency mismatch safeguard
  const [pendingExtraction, setPendingExtraction] = useState<{ values: Values; detectedCurrency: '$' | '£' } | null>(null)

  // ── Scoring ────────────────────────────────────────────────────────────────

  const computeScores = useCallback((vals: Values, tgts: Targets): ScoredMetric[] => {
    // Auto-calculate funnel rates from raw values where not already provided
    const allVals = { ...vals, ...deriveFunnelRates(vals) }
    return METRICS.flatMap((config) => {
      const val = allVals[config.id]
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

  // ── Tile override ──────────────────────────────────────────────────────────

  const startTileEdit = (id: MetricId, currentValue: number) => {
    setEditingTile(id)
    setEditingValue(String(currentValue))
  }

  const commitTileEdit = () => {
    if (!editingTile) return
    const num = parseFloat(editingValue)
    if (!isNaN(num)) {
      const newValues = { ...values, [editingTile]: num }
      setValues(newValues)
      refreshScores(newValues, targets)
      // Clear cached rec so it regenerates with corrected data
      setRecs((p) => { const n = { ...p }; delete n[editingTile!]; return n })
      setRecErrors((p) => { const n = { ...p }; delete n[editingTile!]; return n })
    }
    setEditingTile(null)
    setEditingValue('')
  }

  const cancelTileEdit = () => {
    setEditingTile(null)
    setEditingValue('')
  }

  // ── Screenshot upload ──────────────────────────────────────────────────────

  const handleScreenshot = useCallback(async (file: File) => {
    setScreenshotFile(file)
    setExtractError('')
    setScreenshotPreview(URL.createObjectURL(file))
    setExtracting(true)
    setPendingExtraction(null)

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
        // Currency mismatch check
        const detected = data.detectedCurrency as '$' | '£' | null
        if (detected && detected !== currency) {
          setPendingExtraction({ values: extracted, detectedCurrency: detected })
        } else {
          setValues(extracted)
          setScores(computeScores(extracted, targets))
          setAuditStep('dashboard')
          setSelectedMetric(null)
          setRecs({})
        }
      } catch (err) {
        setExtractError(err instanceof Error ? err.message : 'Failed to read screenshot')
      } finally {
        setExtracting(false)
      }
    }
    reader.readAsDataURL(file)
  }, [targets, computeScores, currency])

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

  // ── Video transcription ────────────────────────────────────────────────────

  const handleTranscribe = async () => {
    if (!videoUrl.trim()) return
    setTranscribing(true)
    setTranscribeError('')
    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: videoUrl }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setTranscript(data.transcript)
    } catch (err) {
      setTranscribeError(err instanceof Error ? err.message : 'Transcription failed')
    } finally {
      setTranscribing(false)
    }
  }

  // ── Voice note → chatContext (browser recording) ──────────────────────────

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop()
      return
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      alert('Voice recording requires Chrome. Please use Chrome or type your notes instead.')
      return
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = Array.from(e.results as any[])
        .slice(e.resultIndex)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => r[0].transcript)
        .join('')
      setChatContext((prev) => prev ? `${prev} ${text}` : text)
    }
    recognition.onend = () => { setIsRecording(false); recognitionRef.current = null }
    recognition.onerror = () => { setIsRecording(false); recognitionRef.current = null }
    recognition.start()
    recognitionRef.current = recognition
    setIsRecording(true)
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
          allScores: scores,
          adType,
          transcript: adType === 'video' ? transcript : undefined,
          imageBase64,
          imageMimeType,
          brandContext: brandContext || undefined,
          chatContext: chatContext || undefined,
          clientBenchmarks: Object.values(benchmarks).some(Boolean) ? benchmarks : undefined,
          currency,
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
        videoUrl,
        onVideoUrlChange: setVideoUrl,
        onTranscribe: handleTranscribe,
        transcribing,
        transcribeError,
        rec: recs[selectedMetric],
        recLoading: recLoading[selectedMetric],
        recError: recErrors[selectedMetric],
        onGenerate: () => generateRec(selectedMetric),
        onToggleCheck: (i: number) => toggleCheck(selectedMetric, i),
        onReanalyse: () => setRecs((p) => { const n = { ...p }; delete n[selectedMetric]; return n }),
        adImageInputRef,
        currency,
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
            {/* Currency toggle — always visible */}
            <div className="flex rounded-lg overflow-hidden border text-xs font-semibold" style={{ borderColor: '#C0D4C0' }}>
              {(['$', '£'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className="px-3 py-1.5 transition-colors"
                  style={{ backgroundColor: currency === c ? '#5A8E5A' : 'transparent', color: currency === c ? '#fff' : '#7A8870' }}
                >
                  {c}
                </button>
              ))}
            </div>

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
                    onClick={() => { setAuditStep('upload'); setManualMode(false); setScreenshotFile(null); setScreenshotPreview(null); setValues({}); setManualInputs({}); setScores([]); setSelectedMetric(null); setRecs({}); setPendingExtraction(null) }}
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
              <CategoryPill category="key" metrics={KEY_METRICS} selected={selectedMetric} onSelect={(id) => setSelectedMetric(id)} scores={scores} currency={currency} />
              {selectedMetric && selectedCategory === 'key' && detailProps && <MetricDetail {...detailProps} />}

              {/* SOFT */}
              <CategoryPill category="soft" metrics={SOFT_METRICS} selected={selectedMetric} onSelect={(id) => setSelectedMetric(id)} scores={scores} currency={currency} />
              {selectedMetric && selectedCategory === 'soft' && detailProps && <MetricDetail {...detailProps} />}

              {/* HARD */}
              <CategoryPill category="hard" metrics={HARD_METRICS} selected={selectedMetric} onSelect={(id) => setSelectedMetric(id)} scores={scores} currency={currency} />
              {selectedMetric && selectedCategory === 'hard' && detailProps && <MetricDetail {...detailProps} />}

              {/* FUNNEL RATES */}
              <CategoryPill category="funnel" metrics={FUNNEL_METRICS} selected={selectedMetric} onSelect={(id) => setSelectedMetric(id)} scores={scores} currency={currency} />
              {selectedMetric && selectedCategory === 'funnel' && detailProps && <MetricDetail {...detailProps} />}
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

            {/* ── Currency mismatch warning ── */}
            {pendingExtraction && (
              <div className="mt-4 rounded-2xl border-2 p-5" style={{ borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' }}>
                <div className="flex items-start gap-3">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#EF4444' }}>
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <p className="font-semibold text-sm mb-1" style={{ color: '#991B1B' }}>Currency mismatch</p>
                    <p className="text-sm mb-4" style={{ color: '#7F1D1D' }}>
                      Your screenshot shows <strong>{pendingExtraction.detectedCurrency}</strong> values but the toggle is set to <strong>{currency}</strong>. Fix this before running the audit.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => {
                          setCurrency(pendingExtraction.detectedCurrency)
                          setValues(pendingExtraction.values)
                          setScores(computeScores(pendingExtraction.values, targets))
                          setAuditStep('dashboard')
                          setSelectedMetric(null)
                          setRecs({})
                          setPendingExtraction(null)
                        }}
                        className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                        style={{ backgroundColor: '#5A8E5A' }}
                      >
                        Switch to {pendingExtraction.detectedCurrency} &amp; continue
                      </button>
                      <button
                        onClick={() => { setPendingExtraction(null); setScreenshotFile(null); setScreenshotPreview(null) }}
                        className="px-4 py-2 rounded-xl text-sm font-medium border transition-colors"
                        style={{ borderColor: '#C0D4C0', color: '#4A5240', backgroundColor: 'white' }}
                      >
                        Re-upload screenshot
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Pre-audit context ── */}
            <div className="mt-6 rounded-2xl border bg-white overflow-hidden" style={{ borderColor: '#E8DCC4' }}>
              <button
                onClick={() => setContextOpen((p) => !p)}
                className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-medium transition-colors hover:bg-amber-50/50"
                style={{ color: '#4A5240' }}
              >
                <span className="flex items-center gap-2">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 opacity-60"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                  Add context before auditing
                  {(brandContext || chatContext || Object.values(benchmarks).some(Boolean)) && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#DCFCE7', color: '#15803D' }}>added</span>
                  )}
                </span>
                <svg viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 transition-transform ${contextOpen ? 'rotate-180' : ''}`}><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </button>

              {contextOpen && (
                <div className="px-5 pb-5 space-y-4 border-t" style={{ borderColor: '#F3F4F6' }}>
                  {/* Brand URL */}
                  <div className="pt-4">
                    <div className="text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#9CA3AF' }}>Brand / product URL</div>
                    <div className="flex gap-2">
                      <input
                        type="url" placeholder="https://yourbrand.com/product"
                        value={brandUrl} onChange={(e) => setBrandUrl(e.target.value)}
                        className="flex-1 text-sm px-3 py-2 rounded-lg border focus:outline-none"
                        style={{ borderColor: '#E8DCC4', backgroundColor: '#FAFAFA' }}
                      />
                      <button onClick={handleScanUrl} disabled={!brandUrl.trim() || urlLoading} className="px-4 py-2 rounded-lg border text-sm font-medium disabled:opacity-40" style={{ borderColor: '#C0D4C0', color: '#5A8E5A' }}>
                        {urlLoading ? '…' : brandContext ? '✓ Scanned' : 'Scan'}
                      </button>
                    </div>
                  </div>

                  {/* Client benchmarks */}
                  <div>
                    <div className="text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#9CA3AF' }}>Client benchmarks (optional)</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                      {[
                        { key: 'breakevenCpa' as const, label: 'Breakeven CPA', prefix: currency },
                        { key: 'accountCpa' as const, label: 'Account CPA', prefix: currency },
                        { key: 'aov' as const, label: 'AOV', prefix: currency },
                        { key: 'ltv' as const, label: 'LTV', prefix: currency },
                        { key: 'subscriberRate' as const, label: 'Subscriber Rate', suffix: '%' },
                      ].map(({ key, label, prefix, suffix }) => (
                        <div key={key}>
                          <div className="text-xs mb-1" style={{ color: '#6B7280' }}>{label}</div>
                          <div className="relative">
                            {prefix && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#9CA3AF' }}>{prefix}</span>}
                            <input
                              type="number" step="any" placeholder="0"
                              value={benchmarks[key]}
                              onChange={(e) => setBenchmarks((p) => ({ ...p, [key]: e.target.value }))}
                              className={`w-full text-sm rounded-lg border px-3 py-2 focus:outline-none ${prefix ? 'pl-6' : ''}`}
                              style={{ borderColor: '#E8DCC4', backgroundColor: '#FAFAFA' }}
                            />
                            {suffix && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: '#9CA3AF' }}>{suffix}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Strategist notes */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>Strategist notes</div>
                      <button
                        onClick={toggleRecording}
                        title={isRecording ? 'Stop recording' : 'Record a voice note'}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${isRecording ? 'animate-pulse' : ''}`}
                        style={{
                          backgroundColor: isRecording ? '#FEE2E2' : '#F0F5F0',
                          color: isRecording ? '#DC2626' : '#5A8E5A',
                          border: `1px solid ${isRecording ? '#FECACA' : '#C0D4C0'}`,
                        }}
                      >
                        {isRecording ? (
                          <><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#DC2626' }} />Recording…</>
                        ) : (
                          <><svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" /></svg>Voice note</>
                        )}
                      </button>
                    </div>
                    <textarea
                      placeholder="Add any context about this ad — what you were testing, who the audience is, how it fits the funnel, anything relevant…"
                      value={chatContext}
                      onChange={(e) => setChatContext(e.target.value)}
                      rows={3}
                      className="w-full text-sm px-3 py-2.5 rounded-lg border focus:outline-none resize-none"
                      style={{ borderColor: isRecording ? '#FCA5A5' : '#E8DCC4', backgroundColor: '#FAFAFA', color: '#374151' }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="text-center mt-4">
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
                          {config.unit === '$' && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#9CA3AF' }}>{currency}</span>}
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
                              {config.unit === '$' && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#9CA3AF' }}>{currency}</span>}
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
            {/* ── Summary + Audit Context panel ── */}
            <div className="mb-8 rounded-2xl border bg-white overflow-hidden" style={{ borderColor: '#E8DCC4' }}>
              {/* Summary row */}
              <div className="flex items-center gap-3 p-3">
                {screenshotPreview && (
                  <img src={screenshotPreview} alt="" className="h-10 rounded-lg object-contain opacity-80 shrink-0" />
                )}
                <div>
                  <div className="text-sm font-medium" style={{ color: '#2D3428' }}>
                    {scores.length} metric{scores.length !== 1 ? 's' : ''} scored
                    {leaks.length > 0 && <span className="ml-2 text-amber-600">· {leaks.length} leak{leaks.length !== 1 ? 's' : ''}</span>}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: '#9DAF9D' }}>Click any tile to diagnose · hover value to correct</div>
                </div>
                <button
                  onClick={() => setContextOpen((p) => !p)}
                  className="ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors"
                  style={{ borderColor: '#C0D4C0', color: contextOpen ? '#5A8E5A' : '#7A8870' }}
                >
                  {(brandContext || chatContext || Object.values(benchmarks).some(Boolean)) && (
                    <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: '#5A8E5A' }} />
                  )}
                  Audit context
                  <svg viewBox="0 0 20 20" fill="currentColor" className={`w-3 h-3 transition-transform ${contextOpen ? 'rotate-180' : ''}`}><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                </button>
              </div>

              {/* Expandable context panel */}
              {contextOpen && (
                <div className="px-5 pb-5 space-y-4 border-t" style={{ borderColor: '#F3F4F6' }}>
                  {/* Brand URL */}
                  <div className="pt-4">
                    <div className="text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#9CA3AF' }}>Brand / product URL</div>
                    <div className="flex gap-2">
                      <input
                        type="url" placeholder="https://yourbrand.com/product"
                        value={brandUrl} onChange={(e) => setBrandUrl(e.target.value)}
                        className="flex-1 text-sm px-3 py-2 rounded-lg border focus:outline-none"
                        style={{ borderColor: '#E8DCC4', backgroundColor: '#FAFAFA' }}
                      />
                      <button onClick={handleScanUrl} disabled={!brandUrl.trim() || urlLoading} className="px-4 py-2 rounded-lg border text-sm font-medium disabled:opacity-40" style={{ borderColor: '#C0D4C0', color: '#5A8E5A' }}>
                        {urlLoading ? '…' : brandContext ? '✓ Scanned' : 'Scan'}
                      </button>
                    </div>
                  </div>

                  {/* Client benchmarks */}
                  <div>
                    <div className="text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#9CA3AF' }}>Client benchmarks</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                      {[
                        { key: 'breakevenCpa' as const, label: 'Breakeven CPA', prefix: currency },
                        { key: 'accountCpa' as const, label: 'Account CPA', prefix: currency },
                        { key: 'aov' as const, label: 'AOV', prefix: currency },
                        { key: 'ltv' as const, label: 'LTV', prefix: currency },
                        { key: 'subscriberRate' as const, label: 'Subscriber Rate', suffix: '%' },
                      ].map(({ key, label, prefix, suffix }) => (
                        <div key={key}>
                          <div className="text-xs mb-1" style={{ color: '#6B7280' }}>{label}</div>
                          <div className="relative">
                            {prefix && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#9CA3AF' }}>{prefix}</span>}
                            <input
                              type="number" step="any" placeholder="—"
                              value={benchmarks[key]}
                              onChange={(e) => setBenchmarks((p) => ({ ...p, [key]: e.target.value }))}
                              className={`w-full text-sm rounded-lg border px-3 py-2 focus:outline-none ${prefix ? 'pl-6' : ''}`}
                              style={{ borderColor: '#E8DCC4', backgroundColor: '#FAFAFA' }}
                            />
                            {suffix && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: '#9CA3AF' }}>{suffix}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Strategist notes */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>Strategist notes</div>
                      <button
                        onClick={toggleRecording}
                        title={isRecording ? 'Stop recording' : 'Record a voice note'}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${isRecording ? 'animate-pulse' : ''}`}
                        style={{
                          backgroundColor: isRecording ? '#FEE2E2' : '#F0F5F0',
                          color: isRecording ? '#DC2626' : '#5A8E5A',
                          border: `1px solid ${isRecording ? '#FECACA' : '#C0D4C0'}`,
                        }}
                      >
                        {isRecording ? (
                          <><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#DC2626' }} />Recording…</>
                        ) : (
                          <><svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" /></svg>Voice note</>
                        )}
                      </button>
                    </div>
                    <textarea
                      placeholder="Any context about this ad — what you were testing, audience, funnel stage, creative hypothesis…"
                      value={chatContext}
                      onChange={(e) => setChatContext(e.target.value)}
                      rows={3}
                      className="w-full text-sm px-3 py-2.5 rounded-lg border focus:outline-none resize-none"
                      style={{ borderColor: isRecording ? '#FCA5A5' : '#E8DCC4', backgroundColor: '#FAFAFA', color: '#374151' }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6">
              {/* KEY */}
              <CategoryPill category="key" metrics={KEY_METRICS} selected={selectedMetric} onSelect={setSelectedMetric} scores={scores} currency={currency}
                editingTile={editingTile} editingValue={editingValue} onStartEdit={startTileEdit} onEditValueChange={setEditingValue} onCommitEdit={commitTileEdit} onCancelEdit={cancelTileEdit} />
              {selectedMetric && selectedCategory === 'key' && detailProps && <MetricDetail {...detailProps} />}

              {/* SOFT */}
              <CategoryPill category="soft" metrics={SOFT_METRICS} selected={selectedMetric} onSelect={setSelectedMetric} scores={scores} currency={currency}
                editingTile={editingTile} editingValue={editingValue} onStartEdit={startTileEdit} onEditValueChange={setEditingValue} onCommitEdit={commitTileEdit} onCancelEdit={cancelTileEdit} />
              {selectedMetric && selectedCategory === 'soft' && detailProps && <MetricDetail {...detailProps} />}

              {/* HARD */}
              <CategoryPill category="hard" metrics={HARD_METRICS} selected={selectedMetric} onSelect={setSelectedMetric} scores={scores} currency={currency}
                editingTile={editingTile} editingValue={editingValue} onStartEdit={startTileEdit} onEditValueChange={setEditingValue} onCommitEdit={commitTileEdit} onCancelEdit={cancelTileEdit} />
              {selectedMetric && selectedCategory === 'hard' && detailProps && <MetricDetail {...detailProps} />}

              {/* FUNNEL RATES */}
              <CategoryPill category="funnel" metrics={FUNNEL_METRICS} selected={selectedMetric} onSelect={setSelectedMetric} scores={scores} currency={currency}
                editingTile={editingTile} editingValue={editingValue} onStartEdit={startTileEdit} onEditValueChange={setEditingValue} onCommitEdit={commitTileEdit} onCancelEdit={cancelTileEdit} />
              {selectedMetric && selectedCategory === 'funnel' && detailProps && <MetricDetail {...detailProps} />}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
