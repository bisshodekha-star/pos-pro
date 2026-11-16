/**
 * response.js — HTTP response helpers (JSON, CORS, errors)
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS_HEADERS,
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
    return new Response(null, { status: 204, headers: CORS_HEADERS });
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

/** CORS headers (for attaching to non-JSON responses) */
export { CORS_HEADERS };
