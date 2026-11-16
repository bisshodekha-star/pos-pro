/**
 * _middleware.js — runs before every API route
 * Handles CORS preflight and adds CORS headers to all responses
 */
import { handleOptions, CORS_HEADERS } from '../_shared/response.js';

export async function onRequest(context) {
  // Handle OPTIONS preflight
  if (context.request.method === 'OPTIONS') {
    return handleOptions(context.request);
  }
  // Continue to the actual route
  const response = await context.next();
  // Attach CORS headers to the response
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    headers.set(k, v);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
