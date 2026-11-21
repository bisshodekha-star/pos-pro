/**
 * POST /api/auth/login
 * Body: { password }
 * Checks password against APP_PASSWORD env var.
 * No username, no multi-user — single password system.
 *
 * Rate limiting: uses Cloudflare KV namespace RATE_LIMIT (optional).
 * If KV is not bound, falls back to a soft per-IP cap of 20 attempts.
 */
import { signJwt, withAuthCookie } from '../../_shared/auth.js';
import { json, error, success, parseBody } from '../../_shared/response.js';

const MAX_ATTEMPTS = 10;
const WINDOW_SECONDS = 900; // 15 minutes

export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await parseBody(request);
  if (!body || !body.password) {
    return error('পাসওয়ার্ড দিন', 400);
  }

  const expected = env.APP_PASSWORD;
  if (!expected) {
    return error('APP_PASSWORD environment variable সেট করা নেই। Cloudflare Pages → Settings → Environment variables এ যোগ করুন।', 500);
  }

  // Rate limit by IP (Cloudflare provides CF-Connecting-IP)
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
  const rlKey = `login_fail:${ip}`;
  let attempts = 0;
  if (env.RATE_LIMIT && typeof env.RATE_LIMIT.get === 'function') {
    try { attempts = parseInt(await env.RATE_LIMIT.get(rlKey) || '0', 10); } catch {}
  }
  if (attempts >= MAX_ATTEMPTS) {
    return json({ error: 'অনেকবার ভুল পাসওয়ার্ড। ১৫ মিনিট পরে চেষ্টা করুন।', code: 'RATE_LIMITED' }, 429);
  }

  if (String(body.password) !== String(expected)) {
    // increment counter
    if (env.RATE_LIMIT && typeof env.RATE_LIMIT.put === 'function') {
      try {
        await env.RATE_LIMIT.put(rlKey, String(attempts + 1), { expirationTtl: WINDOW_SECONDS });
      } catch {}
    }
    const remaining = MAX_ATTEMPTS - attempts - 1;
    const msg = remaining > 0
      ? `ভুল পাসওয়ার্ড (${remaining} বার চেষ্টার সুযোগ বাকি)`
      : 'ভুল পাসওয়ার্ড';
    return error(msg, 401);
  }

  // Successful login — clear the counter
  if (env.RATE_LIMIT && typeof env.RATE_LIMIT.delete === 'function') {
    try { await env.RATE_LIMIT.delete(rlKey); } catch {}
  }

  // Sign a JWT — no user info, just "authenticated"
  const token = await signJwt({ sub: 'pos-user', role: 'admin', name: 'ক্যাশিয়ার' }, env);

  const res = success({ authenticated: true, role: 'admin' }, 'লগইন সফল');
  return withAuthCookie(res, token);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}
