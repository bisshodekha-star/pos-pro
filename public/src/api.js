/**
 * api.js — HTTP API client with auth & error handling
 */
import { CONFIG } from './config.js';

class ApiClient {
  constructor(base = CONFIG.apiBase) {
    this.base = base;
  }

  async call(path, opts = {}) {
    const url = this.base + path;
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      ...opts,
    });

    let data = null;
    try { data = await res.json(); } catch {}

    if (!res.ok) {
      const msg = data?.error || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  get(path) { return this.call(path); }
  post(path, body) { return this.call(path, { method: 'POST', body: JSON.stringify(body) }); }
  put(path, body) { return this.call(path, { method: 'PUT', body: JSON.stringify(body) }); }
  del(path) { return this.call(path, { method: 'DELETE' }); }
}

export const API = new ApiClient();
