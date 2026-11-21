/**
 * store.js — Centralized state management
 * Simple reactive store pattern
 */
import { CONFIG } from './config.js';

export const store = {
  state: {
    user: null,
    settings: {},
    products: [],
    currentView: 'home',
    online: navigator.onLine,
    productsUnlocked: false,
    resetUnlocked: false,
    lastSale: null,
  },

  listeners: new Set(),

  /** Get current state (read-only) */
  get() {
    return this.state;
  },

  /** Update state and notify listeners */
  set(patch) {
    Object.assign(this.state, patch);
    this.notify();
  },

  /** Subscribe to state changes */
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  },

  /** Notify all listeners */
  notify() {
    this.listeners.forEach(fn => fn(this.state));
  },

  /** Shortcut: get settings */
  getSetting(key, fallback = '') {
    return this.state.settings[key] ?? fallback;
  },
};

/** Shortcut for store.get() */
export const getState = () => store.get();

/** Shortcut for store.set() */
export const setState = (patch) => store.set(patch);
