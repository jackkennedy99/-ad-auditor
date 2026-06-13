export type MetricId =
  | 'hookRate'
  | 'holdRate'
  | 'ctr'
  | 'cplc'
  | 'cplpv'
  | 'lpQuality'
  | 'atcPurchase'
  | 'cpa'
  | 'roas'

export type Grade = 'bad' | 'ok' | 'good' | 'great'
export type Direction = 'higher' | 'lower'

export interface MetricConfig {
  id: MetricId
  label: string
  description: string
  unit: '%' | '$' | 'x'
  direction: Direction
  thresholds?: { ok: number; good: number; great: number }
  perClient: boolean
  placeholder: string
}

export const METRICS: MetricConfig[] = [
  {
    id: 'hookRate',
    label: 'Hook Rate',
    description: '3-sec views / impressions',
    unit: '%',
    direction: 'higher',
    thresholds: { ok: 20, good: 28, great: 40 },
    perClient: false,
    placeholder: '25',
  },
  {
    id: 'holdRate',
    label: 'Hold Rate',
    description: 'Avg watch time / video length',
    unit: '%',
    direction: 'higher',
    thresholds: { ok: 4, good: 6, great: 9 },
    perClient: false,
    placeholder: '6',
  },
  {
    id: 'ctr',
    label: 'CTR',
    description: 'Link click CTR',
    unit: '%',
    direction: 'higher',
    thresholds: { ok: 0.5, good: 1, great: 2 },
    perClient: false,
    placeholder: '1.2',
  },
  {
    id: 'cplc',
    label: 'CPLC',
    description: 'Cost per link click',
    unit: '$',
    direction: 'lower',
    thresholds: { ok: 2.0, good: 1.25, great: 0.6 },
    perClient: false,
    placeholder: '1.20',
  },
  {
    id: 'cplpv',
    label: 'CPLPV',
    description: 'Cost per landing page view',
    unit: '$',
    direction: 'lower',
    thresholds: { ok: 2.5, good: 1.5, great: 0.75 },
    perClient: false,
    placeholder: '1.50',
  },
  {
    id: 'lpQuality',
    label: 'LP Quality',
    description: 'Landing page views / link clicks',
    unit: '%',
    direction: 'higher',
    thresholds: { ok: 50, good: 70, great: 85 },
    perClient: false,
    placeholder: '72',
  },
  {
    id: 'atcPurchase',
    label: 'ATC → Purchase',
    description: 'Purchases / add to carts',
    unit: '%',
    direction: 'higher',
    thresholds: { ok: 15, good: 25, great: 40 },
    perClient: false,
    placeholder: '22',
  },
  {
    id: 'cpa',
    label: 'CPA',
    description: 'Cost per acquisition',
    unit: '$',
    direction: 'lower',
    perClient: true,
    placeholder: '45',
  },
  {
    id: 'roas',
    label: 'ROAS',
    description: 'Return on ad spend',
    unit: 'x',
    direction: 'higher',
    perClient: true,
    placeholder: '3.5',
  },
]

export function scoreMetric(
  config: MetricConfig,
  value: number,
  clientTarget?: number
): Grade {
  if (config.perClient) {
    if (!clientTarget || clientTarget <= 0) return 'ok'
    const ratio =
      config.direction === 'higher'
        ? value / clientTarget
        : clientTarget / value
    if (ratio >= 1.2) return 'great'
    if (ratio >= 0.95) return 'good'
    if (ratio >= 0.75) return 'ok'
    return 'bad'
  }

  const { ok, good, great } = config.thresholds!

  if (config.direction === 'higher') {
    if (value >= great) return 'great'
    if (value >= good) return 'good'
    if (value >= ok) return 'ok'
    return 'bad'
  } else {
    if (value <= great) return 'great'
    if (value <= good) return 'good'
    if (value <= ok) return 'ok'
    return 'bad'
  }
}

export function isLeak(grade: Grade): boolean {
  return grade === 'bad' || grade === 'ok'
}

export const GRADE_LABELS: Record<Grade, string> = {
  bad: 'Bad',
  ok: 'OK',
  good: 'Good',
  great: 'Great',
}

export const PLAYBOOKS: Record<MetricId, { causes: string; genericFixes: string }> = {
  hookRate: {
    causes:
      "The opening frame isn't stopping the scroll. Usually the first 2 seconds are too slow, too generic, or fail to signal something relevant to the viewer immediately.",
    genericFixes:
      'Lead with the most specific or surprising claim. Open on motion or an unexpected visual. State the problem or outcome in the first 2 seconds. Try a direct-to-camera hook with a bold statement. Test pattern interrupts — an unusual visual, sound, or format break.',
  },
  holdRate: {
    causes:
      "People are dropping off after the hook. The video isn't delivering on its opening promise, pacing is too slow, or there's no reason to keep watching once the initial curiosity is satisfied.",
    genericFixes:
      'Cut every second of dead air. Tease the payoff early, deliver it late. Use text overlays to reinforce spoken points. Cut between angles or b-roll every 3–5 seconds. Build a micro-narrative — problem, agitation, solution — to pull people through.',
  },
  ctr: {
    causes:
      "The ad isn't translating attention into intent. Viewers are watching but not clicking — usually a mismatch between what the ad promises and what the CTA delivers, or a CTA that's buried or too passive.",
    genericFixes:
      'Make the CTA explicit and urgent — tell them exactly what to do and why now. Ensure the offer or value prop is crystal clear before the CTA. Test a more specific CTA (e.g. "See the full range" vs "Shop now"). Move the CTA earlier. Test overlaying the CTA visually, not just verbally.',
  },
  cplc: {
    causes:
      'Clicks are costing too much — usually a CPM problem feeding through, or CTR underperforming. Could also mean the ad is driving impressions on broad audiences where intent is low.',
    genericFixes:
      'Improve CTR first (cheaper clicks follow). Tighten audience targeting to higher-intent segments. Test creatives that speak to a more specific pain point to self-select higher-intent viewers.',
  },
  cplpv: {
    causes:
      'A gap between CPLC and CPLPV usually means the landing page is slow to load or the ad-to-page transition creates friction — viewers click, page takes too long, they bounce before it registers as an LPV.',
    genericFixes:
      'Check page load speed, especially mobile. Ensure the landing page matches the ad creative visually and in messaging — no jarring transition. Test a dedicated landing page vs. a product detail page.',
  },
  lpQuality: {
    causes:
      'A high drop-off between link clicks and landing page views is almost always a technical or load-speed issue, not a creative one. The click happened — something between click and page view is breaking.',
    genericFixes:
      'Audit mobile page load time — aim for under 3 seconds. Check for redirect chains. Ensure the destination URL is correct and direct. A/B test a faster-loading page or a lighter landing page variant.',
  },
  atcPurchase: {
    causes:
      'People are adding to cart but not converting — checkout friction. Could be price shock at checkout (shipping, taxes), a complicated checkout flow, no urgency to complete, or a lack of trust signals at the final step.',
    genericFixes:
      'Audit the checkout flow for unnecessary steps. Add trust signals near the buy button. Make shipping costs and delivery windows clear before checkout. Test cart abandonment incentives. Ensure mobile checkout is frictionless.',
  },
  cpa: {
    causes:
      "CPA above target means the full funnel isn't converting efficiently enough. Could be a creative problem (wrong audience self-selecting), a landing page problem, or a checkout problem — need to look at where the funnel breaks.",
    genericFixes:
      'Identify the specific funnel leak (CTR, LPQ, ATC rate, checkout CVR) and fix that step first. Test creatives that speak directly to the buyer\'s final objection. Retargeting campaigns often have lower CPA — check if prospecting vs retargeting split is optimised.',
  },
  roas: {
    causes:
      "ROAS below target is the output of all other leaks combined — it's a signal that something upstream in the funnel is broken rather than a root cause in itself.",
    genericFixes:
      'Trace back through the funnel: Hook Rate → Hold Rate → CTR → CPLPV → LPQ → ATC → Checkout CVR. Fix the earliest leak first. Also check AOV — test upsells or bundles to increase average order value without needing more conversions.',
  },
}
