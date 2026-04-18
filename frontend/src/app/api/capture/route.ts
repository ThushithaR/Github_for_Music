import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function backendBase(): string {
  // Prefer explicit override when needed.
  const fromEnv = process.env.BACKEND_BASE_URL;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim().replace(/\/$/, '');

  // Default to localhost backend for local dev.
  return 'http://127.0.0.1:8001';
}

async function postToBackend(endpoint: string, formData: FormData): Promise<Response> {
  return fetch(`${backendBase()}${endpoint}`, {
    method: 'POST',
    body: formData,
    cache: 'no-store',
  });
}

export async function POST(request: Request) {
  try {
    const inbound = await request.formData();

    // Backend is the source of truth for conversion + DB writes.
    const backendRes = await postToBackend('/capture', inbound);

    const text = await backendRes.text();
    let payload: any = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { detail: text || 'Non-JSON response from backend' };
    }

    // Ensure we are talking to github_for_music/backend service, not the legacy flowstate backend.
    if (backendRes.ok && !payload?.blob_hash) {
      return NextResponse.json(
        {
          detail:
            'Wrong backend on BACKEND_BASE_URL. Expected github_for_music/backend response with blob_hash field.',
        },
        { status: 502 }
      );
    }

    // Normalize audio URL shape when backend returns an id.
    if (payload?.audio_url && payload.audio_url.startsWith('/')) {
      payload.audio_url = `${backendBase()}${payload.audio_url}`;
    }

    if (payload?.id && !payload.audio_url) {
      payload.audio_url = `${backendBase()}/audio/${payload.id}.webm`;
    }

    return NextResponse.json(payload, { status: backendRes.status });
  } catch (err: any) {
    return NextResponse.json(
      { detail: `Proxy /api/capture failed: ${err?.message || String(err)}` },
      { status: 500 }
    );
  }
}
