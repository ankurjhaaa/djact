/**
 * djact/navigate.js — SPA Navigation without full page reloads.
 *
 * Usage:
 *   <a dj:navigate="/dashboard">Dashboard</a>
 *
 * Behavior:
 *   1. Intercepts click on dj:navigate links
 *   2. Fetches new page via fetch()
 *   3. Replaces main content (preserves debug FAB)
 *   4. Re-initializes djact components
 *   5. Updates browser URL via pushState
 */
import { bootstrap } from "./core.js";

let _styleInjected = false;
let _listenerBound = false;
let _navigateColor = null;

function injectNavigateStyles() {
  if (_styleInjected) return;
  _styleInjected = true;

  const meta = document.querySelector('meta[name="djact-navigate-color"]');
  _navigateColor = meta ? meta.getAttribute("content") : "#3b82f6";

  const css = `
    [dj\\:navigate] {
      color: ${_navigateColor};
      cursor: pointer;
      text-decoration: none;
      transition: opacity 0.15s ease;
    }
    [dj\\:navigate]:hover {
      opacity: 0.8;
      text-decoration: underline;
    }
    #djact-nav-progress {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 3px;
      z-index: 999999;
      background: linear-gradient(90deg, ${_navigateColor}, ${_navigateColor}88);
      animation: djact-nav-bar 0.8s ease-in-out infinite;
      transform-origin: left;
    }
    @keyframes djact-nav-bar {
      0% { transform: scaleX(0); }
      50% { transform: scaleX(0.7); }
      100% { transform: scaleX(1); }
    }
  `;

  const style = document.createElement("style");
  style.id = "djact-navigate-styles";
  style.textContent = css;
  document.head.appendChild(style);
}

// ── Progress bar ────────────────────────────────────────────────────────────

let _progressBar = null;

function showProgress() {
  if (_progressBar) _progressBar.remove();
  _progressBar = document.createElement("div");
  _progressBar.id = "djact-nav-progress";
  document.body.prepend(_progressBar);
}

function hideProgress() {
  if (_progressBar) {
    _progressBar.remove();
    _progressBar = null;
  }
}

// ── Navigation ──────────────────────────────────────────────────────────────

async function navigateTo(url) {
  showProgress();

  try {
    const response = await fetch(url, {
      headers: { "X-Djact-Navigate": "true" },
      credentials: "same-origin",
    });

    if (!response.ok) {
      console.error(`[djact] Navigation failed: ${response.status}`);
      window.location.href = url;
      return;
    }

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Update <title>
    const newTitle = doc.querySelector("title");
    if (newTitle) document.title = newTitle.textContent;

    // Update meta tags from new page
    const newMetas = doc.querySelectorAll('head meta[name^="djact"]');
    newMetas.forEach(meta => {
      const name = meta.getAttribute("name");
      const existing = document.querySelector(`head meta[name="${name}"]`);
      if (existing) {
        existing.setAttribute("content", meta.getAttribute("content") || "");
      } else {
        document.head.appendChild(meta.cloneNode(true));
      }
    });

    // Save persistent elements (debug FAB & panel)
    const fab = document.getElementById("djact-debug-fab");
    const panel = document.getElementById("djact-debug-panel");
    const savedFab = fab ? fab.cloneNode(true) : null;
    const savedPanel = panel ? panel.cloneNode(true) : null;

    // Replace body content
    const newBody = doc.querySelector("body");
    if (newBody) {
      document.body.innerHTML = newBody.innerHTML;
    }

    // Restore persistent elements
    if (savedFab) document.body.appendChild(savedFab);
    if (savedPanel) document.body.appendChild(savedPanel);

    // Update URL
    window.history.pushState({ djact: true, url }, document.title, url);

    // Re-initialize djact components (marks unbound ones)
    bootstrap();

    window.scrollTo(0, 0);

  } catch (err) {
    console.error("[djact] Navigation error:", err);
    window.location.href = url;
  } finally {
    hideProgress();
  }
}

// ── Event binding (ONLY ONCE) ───────────────────────────────────────────────

function bindNavigation() {
  if (_listenerBound) return;
  _listenerBound = true;

  document.addEventListener("click", (e) => {
    const link = e.target.closest("[dj\\:navigate]");
    if (!link) return;

    e.preventDefault();
    const url = link.getAttribute("dj:navigate") || link.getAttribute("href");
    if (!url) return;

    navigateTo(url);
  });

  window.addEventListener("popstate", (e) => {
    if (e.state && e.state.djact) {
      navigateTo(e.state.url);
    }
  });
}

// ── Initialize ──────────────────────────────────────────────────────────────

export function initNavigate() {
  injectNavigateStyles();
  bindNavigation();
}
