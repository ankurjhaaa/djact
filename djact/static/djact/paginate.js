/**
 * djact/paginate.js — Auto Pagination UI with theme support.
 *
 * Usage:
 *   <div dj:paginate="users"></div>
 *   <div dj:paginate="users" dj:paginate.mode="dark"></div>
 *   <div dj:paginate="users" dj:paginate.mode="light"></div>
 *
 * Expects state to contain pagination info:
 *   { users: [...], pagination: { current_page, total_pages, has_next, has_prev } }
 *
 * Or server-side paginated data:
 *   { users: { data: [...], current_page, last_page } }
 */

// ── Inject styles once ──────────────────────────────────────────────────────

let _stylesInjected = false;

function injectPaginationStyles() {
  if (_stylesInjected) return;
  _stylesInjected = true;

  const css = `
    .djp {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 12px 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      user-select: none;
    }
    .djp-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 36px;
      height: 36px;
      padding: 0 10px;
      border: 1px solid transparent;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      text-decoration: none;
      line-height: 1;
    }
    .djp-dots {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 36px;
      height: 36px;
      font-size: 14px;
      font-weight: 600;
      cursor: default;
    }

    /* ── Light Theme ── */
    .djp--light .djp-btn {
      background: #fff;
      color: #374151;
      border-color: #e5e7eb;
    }
    .djp--light .djp-btn:hover:not(:disabled):not(.djp-btn--active) {
      background: #f3f4f6;
      border-color: #d1d5db;
    }
    .djp--light .djp-btn--active {
      background: #3b82f6;
      color: #fff;
      border-color: #3b82f6;
      box-shadow: 0 1px 3px rgba(59,130,246,0.3);
    }
    .djp--light .djp-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .djp--light .djp-dots {
      color: #9ca3af;
    }
    .djp--light .djp-info {
      color: #6b7280;
      font-size: 13px;
      margin-left: 12px;
    }

    /* ── Dark Theme ── */
    .djp--dark .djp-btn {
      background: #1f2937;
      color: #e5e7eb;
      border-color: #374151;
    }
    .djp--dark .djp-btn:hover:not(:disabled):not(.djp-btn--active) {
      background: #374151;
      border-color: #4b5563;
    }
    .djp--dark .djp-btn--active {
      background: #3b82f6;
      color: #fff;
      border-color: #3b82f6;
      box-shadow: 0 1px 3px rgba(59,130,246,0.4);
    }
    .djp--dark .djp-btn:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }
    .djp--dark .djp-dots {
      color: #6b7280;
    }
    .djp--dark .djp-info {
      color: #9ca3af;
      font-size: 13px;
      margin-left: 12px;
    }
  `;

  const style = document.createElement("style");
  style.id = "djact-paginate-styles";
  style.textContent = css;
  document.head.appendChild(style);
}


// ── Theme detection ─────────────────────────────────────────────────────────

function resolveTheme(container) {
  const explicit = container.getAttribute("dj:paginate.mode");
  if (explicit === "dark" || explicit === "light") return explicit;

  // Auto-detect from CSS prefers-color-scheme
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}


// ── Page number windowing ───────────────────────────────────────────────────

function getPageWindow(current, last, maxVisible = 7) {
  if (last <= maxVisible) {
    return Array.from({ length: last }, (_, i) => i + 1);
  }

  const pages = [];
  const half = Math.floor(maxVisible / 2);
  let start = Math.max(2, current - half);
  let end = Math.min(last - 1, current + half);

  // Adjust if near edges
  if (current <= half + 1) {
    end = Math.min(last - 1, maxVisible - 1);
  }
  if (current >= last - half) {
    start = Math.max(2, last - maxVisible + 2);
  }

  pages.push(1);
  if (start > 2) pages.push("...");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < last - 1) pages.push("...");
  if (last > 1) pages.push(last);

  return pages;
}


// ── Render pagination ───────────────────────────────────────────────────────

export function renderPagination(container, state) {
  injectPaginationStyles();

  const key = container.getAttribute("dj:paginate") || "";
  const value = state[key];
  const pagination = state.pagination || null;

  let current, last, method, isServer;

  // Priority 1: state.pagination object (explicit pagination data)
  if (pagination && typeof pagination.current_page === "number") {
    current = pagination.current_page;
    last = pagination.total_pages || 1;
    method = pagination.method || "change_page";
    isServer = true;
  }
  // Priority 2: server-side paginated data in the list itself
  else if (value && value.data && typeof value.current_page === "number") {
    current = value.current_page;
    last = value.last_page || 1;
    method = value.method || "change_page";
    isServer = true;
  }
  // Priority 3: client-side array pagination
  else if (value && Array.isArray(value)) {
    const attrPer = container.getAttribute("dj:per-page");
    const perPage = attrPer ? (Number(attrPer) || 20) : 20;
    const pages = state.__djact_page || {};
    current = (typeof pages[key] === "number") ? pages[key] : 1;
    last = Math.ceil(value.length / perPage);
    method = null;
    isServer = false;
  } else {
    container.innerHTML = "";
    return;
  }

  // Don't show if only 1 page
  if (last <= 1) {
    container.innerHTML = "";
    return;
  }

  // Store metadata for click handler
  container.dataset.djPaginateMethod = method || "change_page";
  container.dataset.djPaginateKey = key;
  container.dataset.djPaginateIsServer = String(isServer);

  // Theme
  const theme = resolveTheme(container);

  // Build UI
  const wrapper = document.createElement("div");
  wrapper.className = `djp djp--${theme}`;

  // Prev button
  const prev = createBtn("‹ Prev", current - 1, current <= 1);
  wrapper.appendChild(prev);

  // Page numbers with windowing
  const pages = getPageWindow(current, last);
  for (const p of pages) {
    if (p === "...") {
      const dots = document.createElement("span");
      dots.className = "djp-dots";
      dots.textContent = "…";
      wrapper.appendChild(dots);
    } else {
      const btn = createBtn(String(p), p, false);
      if (p === current) btn.classList.add("djp-btn--active");
      wrapper.appendChild(btn);
    }
  }

  // Next button
  const next = createBtn("Next ›", current + 1, current >= last);
  wrapper.appendChild(next);

  // Page info
  const info = document.createElement("span");
  info.className = "djp-info";
  info.textContent = `Page ${current} of ${last}`;
  wrapper.appendChild(info);

  container.innerHTML = "";
  container.appendChild(wrapper);
}

function createBtn(label, page, disabled) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "djp-btn";
  btn.textContent = label;
  btn.dataset.djPage = String(page);
  if (disabled) btn.disabled = true;
  return btn;
}
