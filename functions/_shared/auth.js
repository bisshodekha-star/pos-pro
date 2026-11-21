/**
 * auth.js — JWT (HS256) + password hashing using Web Crypto API
 * Works natively in Cloudflare Workers runtime (no Node.js polyfills)
 */
import { json } from './response.js';

const enc = new TextEncoder();

/* ============================================================
 *  Password hashing (PBKDF2 + SHA-256, 100k iterations)
 * ============================================================ */

function bufToHex(buf) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBuf(hex) {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return arr.buffer;
}

function randomHex(bytes) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return bufToHex(arr.buffer);
}

export async function hashPassword(password, saltHex = null) {
  const salt = saltHex || randomHex(16);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: hexToBuf(salt), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return { hash: bufToHex(bits), salt };
}

export async function verifyPassword(password, hashHex, saltHex) {
  const { hash } = await hashPassword(password, saltHex);
  if (hash.length !== hashHex.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) {
    diff |= hash.charCodeAt(i) ^ hashHex.charCodeAt(i);
  }
  return diff === 0;
}

/* ============================================================
 *  Base64URL helpers
 * ============================================================ */

/**
 * Base64URL helpers — Unicode-safe.
 *
 * btoa() / atob() only handle Latin1 characters, so any non-ASCII
 * content (Bengali, emoji, etc.) inside the JSON payload crashes
 * signing. We UTF-8 encode the string to bytes first, then base64.
 */

function b64urlFromStr(str) {
  // UTF-8 encode → bytes → Latin1 string → btoa
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function b64urlFromBuf(buf) {
  // buf is already raw bytes — convert to Latin1 string for btoa
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function b64urlToStr(b64) {
  let s = b64.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  // atob returns a binary string (one char per byte) — decode as UTF-8
  const binary = atob(s);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function b64urlToBuf(b64) {
  // Returns RAW BYTES (used for signature verification — must NOT
  // go through UTF-8 text encoding, that would corrupt binary data).
  let s = b64.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const binary = atob(s);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf;
}

/* ============================================================
 *  JWT (HS256)
 * ============================================================ */

async function getHmacKey(secret, usage) {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage]
  );
}

export async function signJwt(payload, env, expiresInHours = 12) {
  if (!env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable সেট করা নেই। Cloudflare Pages → Settings → Environment variables এ যোগ করুন।');
  }
  const secret = env.JWT_SECRET;
  const issuer = env.JWT_ISSUER || 'pos-pro';
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iss: issuer,
    iat: now,
    exp: now + expiresInHours * 3600,
  };
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = b64urlFromStr(JSON.stringify(header));
  const payloadB64 = b64urlFromStr(JSON.stringify(fullPayload));
  const data = `${headerB64}.${payloadB64}`;
  const key = await getHmacKey(secret, 'sign');
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return `${data}.${b64urlFromBuf(sig)}`;
}

export async function verifyJwt(token, env) {
  if (!token || !env.JWT_SECRET) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  const data = `${headerB64}.${payloadB64}`;
  const sigBuf = b64urlToBuf(sigB64);
  const key = await getHmacKey(env.JWT_SECRET, 'verify');
  const valid = await crypto.subtle.verify('HMAC', key, sigBuf, enc.encode(data));
  if (!valid) return null;
  let payload;
  try {
    payload = JSON.parse(b64urlToStr(payloadB64));
  } catch {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) return null;
  return payload;
}

/* ============================================================
 *  Cookie helpers — JWT stored in httpOnly cookie
 * ============================================================ */

export function withAuthCookie(response, token, maxAgeHours = 12) {
  const headers = new Headers(response.headers);
  headers.append(
    'Set-Cookie',
    `pos_token=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeHours * 3600}`
  );
  return new Response(response.body, { status: response.status, headers });
}

export function withClearedAuthCookie(response) {
  const headers = new Headers(response.headers);
  headers.append(
    'Set-Cookie',
    'pos_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'
  );
  return new Response(response.body, { status: response.status, headers });
}

export function getTokenFromRequest(request) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/pos_token=([^;]+)/);
  if (match) return match[1];
  const auth = request.headers.get('Authorization');
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

/* ============================================================
 *  Auth guard — returns { user, response }
 *  If response is non-null, send it immediately.
 * ============================================================ */
export async function requireAuth(context, roles = null) {
  const { request, env } = context;
  const token = getTokenFromRequest(request);
  const payload = await verifyJwt(token, env);
  if (!payload) {
    return {
      user: null,
      response: json({ error: 'অনুগ্রহ করে লগইন করুন', code: 'UNAUTHORIZED' }, 401),
    };
  }
  if (roles && !roles.includes(payload.role)) {
    return {
      user: null,
      response: json({ error: 'এই কাজের অনুমতি নেই', code: 'FORBIDDEN' }, 403),
    };
  }
  return { user: payload, response: null };
}
