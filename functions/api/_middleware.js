/**
 * _middleware.js — runs before every API route
 * Handles CORS preflight, adds CORS headers, and catches all errors
 */
import { handleOptions, json } from '../_shared/response.js';

export async function onRequest(context) {
  // Handle OPTIONS preflight — echo the request's Origin (never use '*'
  // with credentials: true)
  if (context.request.method === 'OPTIONS') {
    return handleOptions(context.request);
  }

  try {
    const response = await context.next();
    // Reflect the request Origin on the response so credentialed
    // cross-origin requests (if any) work; same-origin requests are
    // unaffected.
    const headers = new Headers(response.headers);
    const origin = context.request.headers.get('Origin');
    if (origin) {
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Vary', 'Origin');
    } else {
      headers.set('Access-Control-Allow-Origin', '*');
    }
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    headers.set('Access-Control-Allow-Credentials', 'true');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (err) {
    // Catch any unhandled errors and return them as JSON
    const errorDetail = {
      error: err.message || 'Internal Server Error',
      type: err.constructor?.name || 'Error',
    };
    if (err.stack) {
      errorDetail.stack = err.stack.split('\n').slice(0, 5).join('\n');
    }
    return json(errorDetail, 500);
  }
}
