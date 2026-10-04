import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED_CATEGORIES = ['general', 'bug', 'suggestion', 'add_pandal', 'data', 'other'];
const MAX_MESSAGE_LENGTH = 500;
const MAX_PANDAL_NAME_LENGTH = 120;

// Basic in-memory rate limit (per serverless instance, resets on cold start).
// Vercel Firewall provides the primary rate-limit protection.
const requestLog = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = requestLog.get(ip) || { count: 0, start: now };
  if (now - entry.start > WINDOW_MS) {
    entry.count = 0;
    entry.start = now;
  }
  entry.count += 1;
  requestLog.set(ip, entry);
  return entry.count > MAX_REQUESTS_PER_WINDOW;
}

async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { success: false, error: 'Server misconfiguration' };

  const formData = new URLSearchParams();
  formData.append('secret', secret);
  formData.append('response', token);
  if (ip && ip !== 'unknown') formData.append('remoteip', ip);

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    return { success: data.success === true, error: data['error-codes'] };
  } catch (err) {
    return { success: false, error: 'verify_failed' };
  }
}

export async function POST(request) {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Feedback API: missing Supabase env vars');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    if (isRateLimited(ip)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { category, message, pandalName, turnstileToken } = body;

    if (typeof turnstileToken !== 'string' || turnstileToken.length === 0) {
      return NextResponse.json({ error: 'Missing captcha token' }, { status: 400 });
    }

    const turnstileResult = await verifyTurnstile(turnstileToken, ip);
    if (!turnstileResult.success) {
      console.error('Turnstile verification failed:', turnstileResult.error);
      return NextResponse.json({ error: 'Captcha verification failed' }, { status: 400 });
    }

    // Validation
    if (typeof category !== 'string' || !ALLOWED_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    if (typeof message !== 'string') {
      return NextResponse.json({ error: 'Invalid message' }, { status: 400 });
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage.length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }
    if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: 'Message too long' }, { status: 400 });
    }

    let cleanedPandalName = null;
    if (typeof pandalName === 'string' && pandalName.trim().length > 0) {
      cleanedPandalName = pandalName.trim().slice(0, MAX_PANDAL_NAME_LENGTH);
    }

    // Strip any HTML tags to prevent stored XSS
    const sanitizedMessage = trimmedMessage.replace(/<[^>]*>/g, '');
    const sanitizedPandalName = cleanedPandalName
      ? cleanedPandalName.replace(/<[^>]*>/g, '')
      : null;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error } = await supabase.from('feedback').insert({
      category,
      message: sanitizedMessage,
      pandal_id: sanitizedPandalName,
    });

    if (error) {
      console.error('Feedback insert failed:', error.message);
      return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error('Feedback API error:', err);
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
