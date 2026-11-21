/**
 * app.js — Main application entry point
 * Initializes the app, handles routing, renders pages
 *
 * On every page load / refresh, the router forces the user to "home"
 * (see router.js). Deep links like #/billing are ignored on initial load.
 */
import { store, getState, setState } from './store.js';
import { initRouter, navigate, onRoute } from './router.js';
import { API } from './api.js';
import { renderLayout, initLayout, updateContent } from './components/layout.js';
import { initSelects } from './components/select.js';

// Page imports
import * as loginPage from './pages/login.js';
import * as homePage from './pages/home.js';
import * as billingPage from './pages/billing.js';
import * as historyPage from './pages/history.js';
import * as khataPage from './pages/khata.js';
import * as productsPage from './pages/products.js';
import * as stockPage from './pages/stock.js';
import * as customersPage from './pages/customers.js';
import * as reportsPage from './pages/reports.js';
import * as expensePage from './pages/expense.js';
import * as shiftPage from './pages/shift.js';
import * as returnsPage from './pages/returns.js';
import * as filesPage from './pages/files.js';

const PAGES = {
  home: homePage,
  billing: billingPage,
  history: historyPage,
  khata: khataPage,
  products: productsPage,
  stock: stockPage,
  customers: customersPage,
  reports: reportsPage,
  expense: expensePage,
  shift: shiftPage,
  returns: returnsPage,
  files: filesPage,
};

/** Load settings from API (filtered — sensitive keys never returned) */
async function loadSettings() {
  try {
    const r = await API.get('/settings');
    if (r.data) setState({ settings: r.data });
  } catch {}
}

/** Render the current page */
async function renderPage(route) {
  const app = document.getElementById('app');
  if (!app) return;

  // Check auth
  const state = getState();
  if (!state.user) {
    // Try to restore session
    try {
      const r = await API.get('/auth/me');
      if (r.data?.authenticated) {
        setState({ user: r.data });
      }
    } catch {}

    if (!getState().user) {
      app.innerHTML = loginPage.renderLogin();
      loginPage.initLogin(startApp);
      return;
    }
  }

  // Show loading immediately for instant feedback
  const page = PAGES[route] || PAGES.home;
  const loadingHtml = '<div class="flex items-center justify-center py-20 text-slate-400"><div class="text-center"><div class="text-3xl mb-2 animate-pulse">⏳</div>লোড হচ্ছে...</div></div>';

  // If layout already exists, just update content (preserves header events!)
  const existingContent = document.getElementById('page-content');
  if (existingContent) {
    updateContent(loadingHtml);
  } else {
    app.innerHTML = renderLayout(loadingHtml);
    initLayout();
  }

  // Then load page content — use a small timeout so loading shows instantly
  try {
    const content = await page.render();
    if (getState().currentView === route) {
      updateContent(content);
      if (page.init) page.init();
    }
  } catch (err) {
    updateContent(`<div class="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">পেজ লোড ব্যর্থ: ${err.message}</div>`);
  }
}

/** Start the app after login */
async function startApp() {
  await loadSettings();
  initRouter();           // forces route to 'home' on first load
  onRoute(route => renderPage(route));
  renderPage(getState().currentView || 'home');
}

// Boot
initSelects();
startApp();
