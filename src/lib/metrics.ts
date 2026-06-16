export type Category = 'key' | 'soft' | 'hard' | 'funnel'
export type Grade = 'bad' | 'ok' | 'good' | 'great'
export type Direction = 'higher' | 'lower' | 'none'

export type MetricId =
  // Key
  | 'amountSpent' | 'cpm' | 'conversionValue' | 'roas' | 'cpa'
  // Soft
  | 'hookRate' | 'holdRate' | 'ctr' | 'linkClicks' | 'cplc' | 'lpv' | 'cplpv'
  // Hard
  | 'atc' | 'initiateCheckout' | 'purchases'
  // Funnel rates
  | 'lpQuality' | 'atcIc' | 'atcPurchase' | 'icPurchase' | 'lpvPurchase'

export interface MetricConfig {
  id: MetricId
  category: Category
  label: string
  unit: '%' | '$' | '#' | 'x'
  direction: Direction
  thresholds?: { ok: number; good: number; great: number }
  perClient: boolean
  scoreable: boolean
  // For auto-calculation from other metric values
  calcFrom?: { numerator: MetricId; denominator: MetricId }
  what: string
  why: string
  advice: string
}

export const METRICS: MetricConfig[] = [
  // ── KEY ──────────────────────────────────────────────────────────────────
  {
    id: 'amountSpent',
    category: 'key',
    label: 'Amount Spent',
    unit: '$',
    direction: 'none',
    perClient: false,
    scoreable: false,
    what: 'Total budget spent on this ad during the selected period.',
    why: 'Sets context for every other metric — they only make sense relative to spend. Low spend means less data and less reliable signals.',
    advice: "Ensure you're spending enough to exit the learning phase (typically 50+ optimisation events per ad set per week). Don't judge performance under $50 spend unless CPA is extremely high.",
  },
  {
    id: 'cpm',
    category: 'key',
    label: 'CPM',
    unit: '$',
    direction: 'lower',
    perClient: false,
    scoreable: false,
    what: 'Cost per 1,000 impressions — what you pay to reach 1,000 people.',
    why: 'CPM affects everything downstream. High CPM inflates CPLC, CPLPV, and CPA even if the creative is excellent. Varies by vertical, audience size, competition, and creative quality score.',
    advice: 'If CPM is elevated, test broader audiences or improve creative engagement — Meta rewards high-engagement ads with cheaper distribution. High frequency on a single creative also drives CPM up over time.',
  },
  {
    id: 'conversionValue',
    category: 'key',
    label: 'Conversion Value',
    unit: '$',
    direction: 'higher',
    perClient: false,
    scoreable: false,
    what: 'Total revenue attributed to this ad over the selected period.',
    why: 'The headline output — what the ad actually generated in revenue. Look at alongside ROAS and spend, never in isolation.',
    advice: 'Low conversion value relative to spend means the funnel has a leak somewhere. Trace back: is it volume (not enough purchases) or value (AOV is low)? The fix differs. Test upsells and bundles to lift AOV.',
  },
  {
    id: 'roas',
    category: 'key',
    label: 'ROAS',
    unit: 'x',
    direction: 'higher',
    perClient: true,
    scoreable: true,
    what: 'Revenue returned per $1 spent. Conversion Value ÷ Amount Spent.',
    why: 'The efficiency metric for purchase campaigns. Target varies by margin — a 3x ROAS may be unprofitable at 20% margin but excellent at 60% margin.',
    advice: 'ROAS below target is rarely a single-fix problem. Trace the funnel from the top: Hook Rate → Hold Rate → CTR → LP Quality → ATC → Checkout CVR. Fix the earliest leak first.',
  },
  {
    id: 'cpa',
    category: 'key',
    label: 'CPA',
    unit: '$',
    direction: 'lower',
    perClient: true,
    scoreable: true,
    what: 'Cost per acquisition — what you pay per completed purchase.',
    why: 'Core efficiency metric. Tells you whether the ad is profitable given product margin. Target CPA should be set as a % of AOV based on margin requirements.',
    advice: 'CPA above target means something in the funnel is inefficient. Identify where: CTR (creative), LP Quality (page load), ATC rate (landing page), or checkout CVR. Fix the earliest leak first.',
  },

  // ── SOFT ─────────────────────────────────────────────────────────────────
  {
    id: 'hookRate',
    category: 'soft',
    label: 'Hook Rate %',
    unit: '%',
    direction: 'higher',
    thresholds: { ok: 20, good: 28, great: 40 },
    perClient: false,
    scoreable: true,
    what: '% of impressions that resulted in at least 3 seconds of viewing.',
    why: "Your first filter — did the creative stop the scroll? Everything downstream is worthless if the hook fails. Low hook rate means you're paying for ads nobody is watching.",
    advice: 'Lead with your strongest claim or most unexpected visual. The first frame is an ad for the rest of the ad. Test pattern interrupts: unexpected visuals, sounds, or format breaks. Open mid-sentence or mid-action.',
  },
  {
    id: 'holdRate',
    category: 'soft',
    label: 'Hold Rate %',
    unit: '%',
    direction: 'higher',
    thresholds: { ok: 4, good: 6, great: 9 },
    perClient: false,
    scoreable: true,
    what: 'Average watch time as a % of total video length.',
    why: "Tells you if the ad sustained attention after the hook. Strong hook with poor hold = content drop-off mid-ad, people aren't reaching the CTA or offer.",
    advice: 'Cut every second of dead air. Tease the payoff early, deliver it late. Use text overlays to reinforce spoken points. Cut between angles or visuals every 3–5 seconds. Build tension toward a payoff.',
  },
  {
    id: 'ctr',
    category: 'soft',
    label: 'Link Click CTR%',
    unit: '%',
    direction: 'higher',
    thresholds: { ok: 0.5, good: 1, great: 2 },
    perClient: false,
    scoreable: true,
    what: 'Link clicks as a % of impressions — specifically link click CTR, not all-click CTR.',
    why: "Are viewers taking action? High CTR means the offer resonated enough to prompt a click. Low CTR with good Hook/Hold means attention is there but the offer or CTA isn't converting it.",
    advice: 'Make the CTA explicit, visual, and urgent. Ensure the offer or value prop is crystal clear before the CTA moment. Test more specific CTAs. Move the CTA earlier if viewers are dropping before it.',
  },
  {
    id: 'linkClicks',
    category: 'soft',
    label: 'Link Clicks',
    unit: '#',
    direction: 'higher',
    perClient: false,
    scoreable: false,
    what: 'Raw number of link clicks driven by this ad.',
    why: 'Volume signal — are enough people clicking to give meaningful data downstream? Low link clicks limit the reliability of ATC, checkout, and purchase data.',
    advice: 'Low link clicks at normal spend = CTR problem. Low link clicks with low spend = more data needed before drawing conclusions. Think of this as the traffic volume entering your conversion funnel.',
  },
  {
    id: 'cplc',
    category: 'soft',
    label: 'Cost per Link Click',
    unit: '$',
    direction: 'lower',
    thresholds: { ok: 2.0, good: 1.25, great: 0.6 },
    perClient: false,
    scoreable: true,
    what: 'What you pay per link click. Amount Spent ÷ Link Clicks.',
    why: 'Efficiency of driving traffic. CPLC is downstream of both CPM and CTR — if either is high, CPLC suffers regardless of creative quality.',
    advice: "CPLC is a symptom, not a root cause. Fix CTR first (better creative = cheaper clicks), then look at audience cost (CPM). Don't try to fix CPLC directly — trace it upstream.",
  },
  {
    id: 'lpv',
    category: 'soft',
    label: 'Landing Page Views',
    unit: '#',
    direction: 'higher',
    perClient: false,
    scoreable: false,
    what: 'Number of people who successfully loaded your landing page after clicking.',
    why: "A click only counts if the page actually loads. The gap between Link Clicks and LPV reveals page load friction. If the gap is large, you're paying for traffic that never arrives.",
    advice: 'Compare LPV to Link Clicks (see LC→LPV% in Funnel Rates). A significant gap almost always means mobile page load speed. Audit with Google PageSpeed Insights and eliminate redirect chains.',
  },
  {
    id: 'cplpv',
    category: 'soft',
    label: 'Cost per LPV',
    unit: '$',
    direction: 'lower',
    thresholds: { ok: 2.5, good: 1.5, great: 0.75 },
    perClient: false,
    scoreable: true,
    what: 'What you pay per person who actually lands on your page. Amount Spent ÷ Landing Page Views.',
    why: 'More accurate than CPLC — only counts traffic that actually arrived. A big gap between CPLC and CPLPV means page load friction is wasting a portion of every pound you spend.',
    advice: 'If CPLPV >> CPLC, fix page load speed. If both are high, the creative is driving low-quality clicks — look at CTR quality and audience targeting. High CPLPV with low CPM and good CTR = load speed issue.',
  },

  // ── HARD ─────────────────────────────────────────────────────────────────
  {
    id: 'atc',
    category: 'hard',
    label: 'Add to Carts',
    unit: '#',
    direction: 'higher',
    perClient: false,
    scoreable: false,
    what: 'Number of people who added a product to their cart after arriving from this ad.',
    why: "First signal of purchase intent on the landing page. Low ATCs relative to LPV means the page isn't converting browsers into buyers — a product page or offer problem, not a creative one.",
    advice: 'Low ATCs vs LPV = test stronger social proof, clearer offer/value prop, more prominent add-to-cart CTA on page. Ensure the landing page matches what the ad promised — a jarring transition kills intent.',
  },
  {
    id: 'initiateCheckout',
    category: 'hard',
    label: 'Initiate Checkouts',
    unit: '#',
    direction: 'higher',
    perClient: false,
    scoreable: false,
    what: 'Number of people who started the checkout process.',
    why: 'Strong purchase intent. Drop-off between ATC and IC means cart page friction or second thoughts at the price/commitment stage.',
    advice: 'Low IC vs ATC = check cart page UX and shipping cost visibility. Consider a cart abandonment flow. Test cart page simplification. Ensure the price shown on the cart matches what was communicated in the ad.',
  },
  {
    id: 'purchases',
    category: 'hard',
    label: 'Purchases',
    unit: '#',
    direction: 'higher',
    perClient: false,
    scoreable: false,
    what: 'Total completed purchases attributed to this ad.',
    why: 'The core conversion metric — did the ad actually sell? Low purchases relative to IC means checkout friction or payment hesitation at the final step.',
    advice: 'Low purchases vs IC = audit checkout UX for friction. Check for unexpected costs surfacing late (tax, fees). Ensure payment options are trusted and visible. Test one-page checkout if currently multi-step.',
  },

  // ── FUNNEL RATES ──────────────────────────────────────────────────────────
  {
    id: 'lpQuality',
    category: 'funnel',
    label: 'LC → LPV %',
    unit: '%',
    direction: 'higher',
    thresholds: { ok: 50, good: 70, great: 85 },
    perClient: false,
    scoreable: true,
    calcFrom: { numerator: 'lpv', denominator: 'linkClicks' },
    what: 'Landing Page Views ÷ Link Clicks × 100. What % of clicks actually load the page.',
    why: 'Measures traffic delivery quality. A low % means people clicked but the page bounced before loading — a technical problem, not a creative one.',
    advice: 'Below 70% is almost always mobile page load speed. Run Google PageSpeed on mobile. Check for redirect chains. Test a lighter, faster landing page variant. Ensure destination URL is correct and direct.',
  },
  {
    id: 'atcIc',
    category: 'funnel',
    label: 'ATC → IC %',
    unit: '%',
    direction: 'higher',
    thresholds: { ok: 35, good: 55, great: 70 },
    perClient: false,
    scoreable: true,
    calcFrom: { numerator: 'initiateCheckout', denominator: 'atc' },
    what: 'Initiate Checkouts ÷ Add to Carts × 100. What % of cart-adders actually start checkout.',
    why: 'Reveals friction between the cart and checkout. Strong ATC numbers mean the ad and page created real intent — if that intent is dying before checkout, something in the cart experience is killing it.',
    advice: 'Low ATC→IC usually means shipping cost shock or friction on the cart page. Show shipping costs earlier, simplify the cart page, add a trust signal near the checkout button. Test removing login requirements.',
  },
  {
    id: 'atcPurchase',
    category: 'funnel',
    label: 'ATC → Purchase %',
    unit: '%',
    direction: 'higher',
    thresholds: { ok: 15, good: 25, great: 40 },
    perClient: false,
    scoreable: true,
    calcFrom: { numerator: 'purchases', denominator: 'atc' },
    what: 'Purchases ÷ Add to Carts × 100. What % of people who added to cart actually bought.',
    why: 'A composite view of the checkout funnel — captures both cart-to-checkout and checkout-to-purchase drop-off in one number. Below 25% almost always means checkout friction somewhere in the flow.',
    advice: 'Check for price shock at checkout (shipping/tax reveal), too many checkout steps, weak trust signals near the buy button, or slow checkout load on mobile. Test accelerated checkout options (Shop Pay, Apple Pay).',
  },
  {
    id: 'icPurchase',
    category: 'funnel',
    label: 'IC → Purchase %',
    unit: '%',
    direction: 'higher',
    thresholds: { ok: 40, good: 60, great: 78 },
    perClient: false,
    scoreable: true,
    calcFrom: { numerator: 'purchases', denominator: 'initiateCheckout' },
    what: 'Purchases ÷ Initiate Checkouts × 100. What % of people who started checkout actually completed it.',
    why: 'The most specific checkout signal — someone has already reached the checkout page and started filling it in. Drop-off here is almost always a payment, UX, or trust issue on the checkout page itself.',
    advice: 'Below 60% at this stage points to: payment method friction (add Shop Pay, Apple Pay, Klarna), unexpected fees appearing at checkout, slow checkout load on mobile, or lack of trust signals (SSL badge, reviews) near the pay button.',
  },
  {
    id: 'lpvPurchase',
    category: 'funnel',
    label: 'LPV → Purchase %',
    unit: '%',
    direction: 'higher',
    thresholds: { ok: 0.5, good: 1.5, great: 3 },
    perClient: false,
    scoreable: true,
    calcFrom: { numerator: 'purchases', denominator: 'lpv' },
    what: 'Purchases ÷ Landing Page Views × 100. Overall page-to-purchase conversion rate from paid social traffic.',
    why: 'The single number that captures your entire on-site funnel. Low LPV→Purchase means somewhere between the page load and the purchase, you\'re losing people. Great for benchmarking landing page performance over time.',
    advice: 'This is a diagnostic top-line number — use the other funnel rates to find where the drop-off happens. Low LPV→Purchase with high ATC→Purchase = ATC rate is the problem (page). Low ATC→Purchase with high IC→Purchase = cart friction.',
  },
]

// ── Category metadata ─────────────────────────────────────────────────────

export const CATEGORY_META = {
  key: {
    label: 'Key Metrics',
    bg: '#FEFCE8',
    border: '#FDE047',
    accent: '#CA8A04',
    chevronBorder: '#EAB308',
    textColor: '#713F12',
    pillBg: '#FEF08A',
  },
  soft: {
    label: 'Soft Metrics',
    bg: '#F0FDF4',
    border: '#86EFAC',
    accent: '#16A34A',
    chevronBorder: '#22C55E',
    textColor: '#14532D',
    pillBg: '#BBF7D0',
  },
  hard: {
    label: 'Hard Metrics',
    bg: '#EFF6FF',
    border: '#93C5FD',
    accent: '#2563EB',
    chevronBorder: '#3B82F6',
    textColor: '#1E3A8A',
    pillBg: '#BFDBFE',
  },
  funnel: {
    label: 'Funnel Rates',
    bg: '#FAF5FF',
    border: '#D8B4FE',
    accent: '#7C3AED',
    chevronBorder: '#A855F7',
    textColor: '#4C1D95',
    pillBg: '#EDE9FE',
  },
} as const

// ── Scoring ───────────────────────────────────────────────────────────────

export function scoreMetric(
  config: MetricConfig,
  value: number,
  clientTarget?: number
): Grade | null {
  if (!config.scoreable) return null

  if (config.perClient) {
    if (!clientTarget || clientTarget <= 0) return null
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

export function isLeak(grade: Grade | null): boolean {
  return grade === 'bad' || grade === 'ok'
}

export const GRADE_LABELS: Record<Grade, string> = {
  bad: 'Bad',
  ok: 'OK',
  good: 'Good',
  great: 'Great',
}

export const GRADE_STYLES: Record<Grade, { bg: string; text: string; bar: string; border: string }> = {
  bad:   { bg: '#FEF2F2', text: '#B91C1C', bar: '#F87171', border: '#FECACA' },
  ok:    { bg: '#FFFBEB', text: '#B45309', bar: '#FBBF24', border: '#FDE68A' },
  good:  { bg: '#F0FDF4', text: '#15803D', bar: '#4ADE80', border: '#BBF7D0' },
  great: { bg: '#ECFDF5', text: '#047857', bar: '#34D399', border: '#A7F3D0' },
}

export function formatValue(config: MetricConfig, value: number): string {
  if (config.unit === '$') {
    return value >= 1000
      ? `$${(value / 1000).toFixed(1)}k`
      : `$${value % 1 === 0 ? value : value.toFixed(2)}`
  }
  if (config.unit === 'x') return `${value}x`
  if (config.unit === '%') {
    // Show one decimal for small percentages
    return value < 1 ? `${value.toFixed(2)}%` : `${value % 1 === 0 ? value : value.toFixed(1)}%`
  }
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : `${value}`
}

// ── Grouped metric lists ──────────────────────────────────────────────────

export const KEY_METRICS    = METRICS.filter((m) => m.category === 'key')
export const SOFT_METRICS   = METRICS.filter((m) => m.category === 'soft')
export const HARD_METRICS   = METRICS.filter((m) => m.category === 'hard')
export const FUNNEL_METRICS = METRICS.filter((m) => m.category === 'funnel')

// ── Auto-calculate funnel rates from raw values ───────────────────────────

export function deriveFunnelRates(
  values: Partial<Record<MetricId, number>>
): Partial<Record<MetricId, number>> {
  const derived: Partial<Record<MetricId, number>> = {}
  for (const config of METRICS) {
    if (!config.calcFrom) continue
    if (values[config.id] !== undefined) continue // already provided
    const num = values[config.calcFrom.numerator]
    const den = values[config.calcFrom.denominator]
    if (num !== undefined && den !== undefined && den > 0) {
      derived[config.id] = parseFloat(((num / den) * 100).toFixed(2))
    }
  }
  return derived
}
