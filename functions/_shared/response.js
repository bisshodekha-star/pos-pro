/**
 * response.js — HTTP response helpers (JSON, CORS, errors)
 *
 * CORS note: When `Access-Control-Allow-Credentials: true` is set,
 * the browser REQUIRES a specific origin (not `*`). We reflect the
 * request's Origin header back. Same-origin requests (the normal case
 * for this app, since frontend + API live on the same Cloudflare
 * Pages domain) don't trigger CORS at all.
 */

const ALLOWED_HEADERS = 'Content-Type, Authorization';
const ALLOWED_METHODS = 'GET, POST, PUT, DELETE, OPTIONS';

function corsHeadersFor(request) {
  const origin = (request && request.headers && request.headers.get('Origin')) || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': ALLOWED_METHODS,
    'Access-Control-Allow-Headers': ALLOWED_HEADERS,
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
  };
}

// For non-preflight JSON responses we can't know the request here without
// threading it through every call site, so default to '*'. Same-origin
// requests (the normal case) are unaffected; cross-origin credentialed
// requests should go through `_middleware.js`, which sets proper CORS
// headers on the wrapped response.
const DEFAULT_CORS = corsHeadersFor(null);

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...DEFAULT_CORS,
      ...extraHeaders,
    },
  });
}

export function error(message, status = 400, details = null) {
  const body = { error: message };
  if (details) body.details = details;
  return json(body, status);
}

export function success(data = null, message = null, status = 200) {
  const body = { ok: true };
  if (data !== null) body.data = data;
  if (message) body.message = message;
  return json(body, status);
}

/** Handle OPTIONS preflight for all routes */
export function handleOptions(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeadersFor(request) });
  }
  return null;
}

/** Parse JSON body safely */
export async function parseBody(request) {
  try {
    return await request.json();
  } catch (e) {
    return null;
  }
}

/** CORS headers (computed per request) — for use in middleware */
export function corsHeaders(request) {
  return corsHeadersFor(request);
}

/** Backwards-compat constant (used by some old imports) */
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': ALLOWED_METHODS,
  'Access-Control-Allow-Headers': ALLOWED_HEADERS,
  'Access-Control-Allow-Credentials': 'true',
};
