import { NextResponse } from 'next/server'

// Bump this string whenever you want to confirm a deploy actually landed.
// Fetch /api/version on the live site and check that `version` matches.
// Vercel's GitHub webhook is intermittent, so this is the source of truth
// for "did my push actually go live".
const VERSION = 'hookhold-safeguard-2026-06-17'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    version: VERSION,
    deployedAt: new Date().toISOString(),
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? 'local',
  })
}
