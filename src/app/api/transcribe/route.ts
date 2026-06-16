import { NextRequest, NextResponse } from 'next/server'

const ASSEMBLYAI_API = 'https://api.assemblyai.com/v2'
const POLL_INTERVAL_MS = 3000
const MAX_WAIT_MS = 50000 // 50s — enough for any short-form ad

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ASSEMBLYAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Transcription not configured — add ASSEMBLYAI_API_KEY to your environment variables.' }, { status: 500 })
  }

  const { url }: { url: string } = await req.json()

  if (!url?.trim()) {
    return NextResponse.json({ error: 'No URL provided' }, { status: 400 })
  }

  const headers = {
    authorization: apiKey,
    'content-type': 'application/json',
  }

  // Step 1: Submit for transcription
  let transcriptId: string
  try {
    const submitRes = await fetch(`${ASSEMBLYAI_API}/transcript`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        audio_url: url,
        language_detection: true,
      }),
    })
    if (!submitRes.ok) {
      const err = await submitRes.json().catch(() => ({}))
      const msg = (err as { error?: string }).error || submitRes.statusText
      return NextResponse.json({ error: `Transcription service error: ${msg}` }, { status: 502 })
    }
    const submitted = await submitRes.json() as { id: string; error?: string }
    if (submitted.error) {
      return NextResponse.json({ error: submitted.error }, { status: 422 })
    }
    transcriptId = submitted.id
  } catch (err) {
    return NextResponse.json({ error: `Failed to reach transcription service: ${err instanceof Error ? err.message : err}` }, { status: 502 })
  }

  // Step 2: Poll until complete or timeout
  const deadline = Date.now() + MAX_WAIT_MS

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS)

    const pollRes = await fetch(`${ASSEMBLYAI_API}/transcript/${transcriptId}`, { headers })
    if (!pollRes.ok) {
      return NextResponse.json({ error: 'Failed to check transcription status' }, { status: 502 })
    }

    const result = await pollRes.json() as {
      status: 'queued' | 'processing' | 'completed' | 'error'
      text?: string
      error?: string
    }

    if (result.status === 'completed') {
      return NextResponse.json({ transcript: result.text ?? '' })
    }

    if (result.status === 'error') {
      return NextResponse.json(
        { error: result.error || 'Transcription failed. Check the URL is a publicly accessible video file.' },
        { status: 422 }
      )
    }

    // status is 'queued' or 'processing' — keep polling
  }

  return NextResponse.json(
    { error: 'Transcription timed out. The video may be too long or the URL may not be accessible.' },
    { status: 504 }
  )
}
