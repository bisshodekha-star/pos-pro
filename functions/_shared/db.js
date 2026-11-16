/**
 * db.js — Neon PostgreSQL connection helper for Cloudflare Pages Functions
 * Uses @neondatabase/serverless which works in Cloudflare Workers runtime
 */
import { neon } from '@neondatabase/serverless';

/**
 * Get a Neon SQL client bound to the current request's env.
 * Usage in a Pages Function:
 *   export async function onRequest(context) {
 *     const sql = getSql(context.env);
 *     const rows = await sql`SELECT * FROM products`;
 *   }
 */
export function getSql(env) {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Add it in Cloudflare Pages → Settings → Environment variables.');
  }
  return neon(env.DATABASE_URL);
}
