/**
 * djact/debug.js — Developer Debug Panel.
 *
 * Only active when <meta name="djact-debug" content="true"> is present
 * (injected by middleware when Django DEBUG=True).
 *
 * Features:
 *   - Floating draggable button
 *   - Request/response inspector
 *   - Performance timing
 *   - Error tracking (Django + JS)
 *   - Action logs
 */

// ── State ───────────────────────────────────────────────────────────────────

const _logs = [];
const _errors = [];
const MAX_LOGS = 50;
let _panelOpen = false;
let _panelEl = null;
let _fabEl = null;
let _activeTab = "requests";

// ── Public API (used by api.js) ─────────────────────────────────────────────

export function logRequest(entry) {
  _logs.unshift(entry);
  if (_logs.length > MAX_LOGS) _logs.pop();
  updateBadge();
  if (_panelOpen) renderPanel();
}

export function logError(entry) {
  _errors.unshift(entry);
  if (_errors.length > MAX_LOGS) _errors.pop();
  updateBadge();
  if (_panelOpen) renderPanel();
}

export function isDebugEnabled() {
  const meta = document.querySelector('meta[name="djact-debug"]');
  return meta && meta.getAttribute("content") === "true";
}

// ── Global error capture ────────────────────────────────────────────────────

let _errorsCaptured = false;

function captureGlobalErrors() {
  if (_errorsCaptured) return;
  _errorsCaptured = true;

  window.addEventListener("error", (e) => {
    logError({
      type: "js",
      message: e.message,
      source: e.filename ? `${e.filename}:${e.lineno}` : "unknown",
      time: new Date().toLocaleTimeString(),
    });
  });

  window.addEventListener("unhandledrejection", (e) => {
    logError({
      type: "promise",
      message: e.reason ? String(e.reason) : "Unhandled promise rejection",
      source: "async",
      time: new Date().toLocaleTimeString(),
    });
  });
}

// ── Styles ──────────────────────────────────────────────────────────────────

function injectDebugStyles() {
  if (document.getElementById("djact-debug-styles")) return;

  const css = `
    #djact-debug-fab {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: linear-gradient(135deg, #1e293b, #334155);
      color: #38bdf8;
      border: 2px solid #475569;
      cursor: grab;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      font-weight: 900;
      z-index: 999999;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
      transition: transform 0.15s, box-shadow 0.15s;
      user-select: none;
      font-family: monospace;
    }
    #djact-debug-fab:hover { transform: scale(1.1); box-shadow: 0 6px 28px rgba(0,0,0,0.5); }
    #djact-debug-fab:active { cursor: grabbing; }
    #djact-debug-fab .badge {
      position: absolute;
      top: -4px;
      right: -4px;
      min-width: 18px;
      height: 18px;
      border-radius: 9px;
      background: #ef4444;
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 4px;
      font-family: system-ui, sans-serif;
    }

    #djact-debug-panel {
      position: fixed;
      bottom: 80px;
      right: 20px;
      width: 480px;
      max-height: 70vh;
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 16px;
      z-index: 999998;
      box-shadow: 0 20px 60px rgba(0,0,0,0.6);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      color: #e2e8f0;
      font-size: 13px;
      animation: djact-debug-in 0.2s ease;
    }
    @keyframes djact-debug-in {
      from { opacity: 0; transform: translateY(10px) scale(0.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    .djd-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: #1e293b;
      border-bottom: 1px solid #334155;
    }
    .djd-header h3 {
      margin: 0;
      font-size: 14px;
      font-weight: 800;
      color: #38bdf8;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .djd-close {
      background: none;
      border: none;
      color: #64748b;
      font-size: 18px;
      cursor: pointer;
      padding: 4px;
      border-radius: 6px;
      transition: all 0.1s;
    }
    .djd-close:hover { color: #ef4444; background: #1e293b; }

    .djd-tabs {
      display: flex;
      background: #1e293b;
      border-bottom: 1px solid #334155;
      padding: 0 8px;
      gap: 2px;
    }
    .djd-tab {
      padding: 8px 14px;
      font-size: 12px;
      font-weight: 700;
      color: #64748b;
      cursor: pointer;
      border: none;
      background: none;
      border-bottom: 2px solid transparent;
      transition: all 0.15s;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .djd-tab:hover { color: #94a3b8; }
    .djd-tab--active { color: #38bdf8; border-bottom-color: #38bdf8; }

    .djd-body {
      flex: 1;
      overflow-y: auto;
      padding: 12px 16px;
      max-height: 50vh;
    }
    .djd-body::-webkit-scrollbar { width: 6px; }
    .djd-body::-webkit-scrollbar-track { background: transparent; }
    .djd-body::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }

    .djd-card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 10px;
      padding: 12px;
      margin-bottom: 10px;
    }
    .djd-card-title {
      font-size: 11px;
      font-weight: 800;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 8px;
    }
    .djd-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 0;
    }
    .djd-label { color: #94a3b8; font-size: 12px; }
    .djd-value { color: #e2e8f0; font-weight: 600; font-size: 12px; }
    .djd-value--success { color: #22c55e; }
    .djd-value--error { color: #ef4444; }
    .djd-value--warn { color: #f59e0b; }
    .djd-value--info { color: #38bdf8; }

    .djd-json {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 10px;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 11px;
      color: #94a3b8;
      overflow-x: auto;
      max-height: 200px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-all;
      margin-top: 6px;
    }

    .djd-empty {
      text-align: center;
      padding: 32px 16px;
      color: #475569;
      font-size: 13px;
    }

    .djd-error-item {
      background: #1c1017;
      border: 1px solid #7f1d1d;
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 8px;
    }
    .djd-error-type {
      font-size: 10px;
      font-weight: 800;
      color: #ef4444;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .djd-error-msg {
      color: #fca5a5;
      font-size: 12px;
      word-break: break-word;
    }
    .djd-error-source {
      color: #6b7280;
      font-size: 10px;
      margin-top: 4px;
    }

    .djd-log-item {
      padding: 6px 0;
      border-bottom: 1px solid #1e293b;
      display: flex;
      gap: 8px;
      align-items: flex-start;
    }
    .djd-log-time {
      color: #475569;
      font-size: 10px;
      font-family: monospace;
      white-space: nowrap;
      min-width: 72px;
    }
    .djd-log-action {
      color: #e2e8f0;
      font-size: 12px;
      word-break: break-word;
    }

    .djd-status {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
    }
    .djd-status--ok { background: #052e16; color: #22c55e; }
    .djd-status--err { background: #2a0a0a; color: #ef4444; }
  `;

  const style = document.createElement("style");
  style.id = "djact-debug-styles";
  style.textContent = css;
  document.head.appendChild(style);
}

// ── FAB (Floating Action Button) ────────────────────────────────────────────

let _dragBound = false;

function createFab() {
  // Check if FAB already exists in DOM (could survive navigation)
  const existing = document.getElementById("djact-debug-fab");
  if (existing) {
    _fabEl = existing;
    return;
  }
  if (_fabEl && _fabEl.parentElement) return;

  const fab = document.createElement("div");
  fab.id = "djact-debug-fab";
  fab.innerHTML = `⚡`;
  fab.title = "Djact Debug Panel";
  document.body.appendChild(fab);
  _fabEl = fab;

  // Click toggle
  fab.addEventListener("click", (e) => {
    if (fab._dragged) { fab._dragged = false; return; }
    togglePanel();
  });

  // Drag (bind document-level listeners only once)
  if (!_dragBound) {
    _dragBound = true;
    let isDragging = false, startX, startY, startLeft, startTop, dragTarget;

    document.addEventListener("mousedown", (e) => {
      const el = e.target.closest("#djact-debug-fab");
      if (!el) return;
      isDragging = true;
      dragTarget = el;
      dragTarget._dragged = false;
      startX = e.clientX;
      startY = e.clientY;
      const rect = el.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      el.style.transition = "none";
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging || !dragTarget) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragTarget._dragged = true;
      dragTarget.style.left = (startLeft + dx) + "px";
      dragTarget.style.top = (startTop + dy) + "px";
      dragTarget.style.right = "auto";
      dragTarget.style.bottom = "auto";
    });

    document.addEventListener("mouseup", () => {
      if (isDragging && dragTarget) {
        dragTarget.style.transition = "";
      }
      isDragging = false;
      dragTarget = null;
    });
  }
}

function updateBadge() {
  if (!_fabEl) return;
  let badge = _fabEl.querySelector(".badge");
  const count = _errors.length;
  if (count === 0) {
    if (badge) badge.remove();
    return;
  }
  if (!badge) {
    badge = document.createElement("span");
    badge.className = "badge";
    _fabEl.appendChild(badge);
  }
  badge.textContent = count > 9 ? "9+" : String(count);
}

// ── Panel ───────────────────────────────────────────────────────────────────

function togglePanel() {
  if (_panelOpen) {
    closePanel();
  } else {
    openPanel();
  }
}

function openPanel() {
  _panelOpen = true;
  if (!_panelEl) {
    _panelEl = document.createElement("div");
    _panelEl.id = "djact-debug-panel";
    document.body.appendChild(_panelEl);
  }
  _panelEl.style.display = "flex";
  renderPanel();
}

function closePanel() {
  _panelOpen = false;
  if (_panelEl) _panelEl.style.display = "none";
}

function renderPanel() {
  if (!_panelEl) return;

  const tabs = ["requests", "errors", "logs"];

  _panelEl.innerHTML = `
    <div class="djd-header">
      <h3>⚡ Djact DevTools</h3>
      <button class="djd-close" id="djd-close-btn">✕</button>
    </div>
    <div class="djd-tabs">
      ${tabs.map(t => `
        <button class="djd-tab ${t === _activeTab ? 'djd-tab--active' : ''}" data-djd-tab="${t}">
          ${t === "requests" ? `Requests (${_logs.length})` : ""}
          ${t === "errors" ? `Errors (${_errors.length})` : ""}
          ${t === "logs" ? "Logs" : ""}
        </button>
      `).join("")}
    </div>
    <div class="djd-body" id="djd-body"></div>
  `;

  // Tab clicks
  _panelEl.querySelectorAll(".djd-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      _activeTab = btn.dataset.djdTab;
      renderPanel();
    });
  });

  // Close
  _panelEl.querySelector("#djd-close-btn").addEventListener("click", closePanel);

  // Body content
  const body = _panelEl.querySelector("#djd-body");

  if (_activeTab === "requests") {
    renderRequestsTab(body);
  } else if (_activeTab === "errors") {
    renderErrorsTab(body);
  } else if (_activeTab === "logs") {
    renderLogsTab(body);
  }
}

// ── Tab: Requests ───────────────────────────────────────────────────────────

function renderRequestsTab(container) {
  if (_logs.length === 0) {
    container.innerHTML = `<div class="djd-empty">No requests yet. Interact with a component.</div>`;
    return;
  }

  container.innerHTML = _logs.map((log, i) => `
    <div class="djd-card">
      <div class="djd-card-title">
        <span class="djd-status ${log.status < 400 ? 'djd-status--ok' : 'djd-status--err'}">${log.status || "?"}</span>
        &nbsp; ${log.component}.${log.method}
      </div>

      <div class="djd-row">
        <span class="djd-label">Component</span>
        <span class="djd-value djd-value--info">${log.component}</span>
      </div>
      <div class="djd-row">
        <span class="djd-label">Method</span>
        <span class="djd-value">${log.method}</span>
      </div>
      <div class="djd-row">
        <span class="djd-label">Endpoint</span>
        <span class="djd-value" style="font-size:11px">${log.url || "/djact/"}</span>
      </div>
      <div class="djd-row">
        <span class="djd-label">Latency</span>
        <span class="djd-value ${log.latency > 500 ? 'djd-value--warn' : 'djd-value--success'}">${log.latency}ms</span>
      </div>
      <div class="djd-row">
        <span class="djd-label">Time</span>
        <span class="djd-value">${log.time}</span>
      </div>

      <details style="margin-top:8px">
        <summary style="cursor:pointer;color:#64748b;font-size:11px;font-weight:700">REQUEST PAYLOAD</summary>
        <div class="djd-json">${escapeHtml(JSON.stringify(log.request, null, 2))}</div>
      </details>

      <details style="margin-top:6px">
        <summary style="cursor:pointer;color:#64748b;font-size:11px;font-weight:700">RESPONSE DATA</summary>
        <div class="djd-json">${escapeHtml(JSON.stringify(log.response, null, 2))}</div>
      </details>
    </div>
  `).join("");
}

// ── Tab: Errors ─────────────────────────────────────────────────────────────

function renderErrorsTab(container) {
  if (_errors.length === 0) {
    container.innerHTML = `<div class="djd-empty">No errors. Everything is working. ✓</div>`;
    return;
  }

  container.innerHTML = _errors.map(err => `
    <div class="djd-error-item">
      <div class="djd-error-type">${err.type} error</div>
      <div class="djd-error-msg">${escapeHtml(err.message)}</div>
      <div class="djd-error-source">${escapeHtml(err.source || "")} · ${err.time}</div>
    </div>
  `).join("");
}

// ── Tab: Logs ───────────────────────────────────────────────────────────────

function renderLogsTab(container) {
  const allLogs = [
    ..._logs.map(l => ({ time: l.time, action: `${l.component}.${l.method}() → ${l.status}` })),
    ..._errors.map(e => ({ time: e.time, action: `⚠ ${e.type}: ${e.message}` })),
  ].sort((a, b) => (a.time > b.time ? -1 : 1));

  if (allLogs.length === 0) {
    container.innerHTML = `<div class="djd-empty">No activity yet.</div>`;
    return;
  }

  container.innerHTML = allLogs.map(l => `
    <div class="djd-log-item">
      <span class="djd-log-time">${l.time}</span>
      <span class="djd-log-action">${escapeHtml(l.action)}</span>
    </div>
  `).join("");
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Initialize ──────────────────────────────────────────────────────────────

export function initDebug() {
  if (!isDebugEnabled()) return;
  injectDebugStyles();
  captureGlobalErrors();
  createFab();
}
