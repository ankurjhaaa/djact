/**
 * djact/paginate.js — Auto Pagination UI (Laravel-style).
 *
 * Usage:
 *   <div dj:paginate="users"></div>
 *   <div dj:paginate="users" dj:paginate.mode="dark"></div>
 *   <div dj:paginate="users" dj:paginate.mode="light"></div>
 *
 * State format (from djact.pagination.paginate):
 *   {
 *     users: [...],
 *     pagination: { current_page, total_pages, has_next, has_prev, per_page, total }
 *   }
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
      width: 100%;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      user-select: none;
    }
    .djp-list {
      display: flex;
      align-items: center;
      flex: 1;
      flex-wrap: wrap;
    }
    .djp-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 38px;
      height: 38px;
      padding: 0 12px;
      border: 1px solid;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.12s, color 0.12s, border-color 0.12s;
      text-decoration: none;
      line-height: 1;
      margin-left: -1px;
    }
    .djp-btn:first-child {
      border-radius: 4px 0 0 4px;
      margin-left: 0;
    }
    .djp-btn:last-child {
      border-radius: 0 4px 4px 0;
    }
    .djp-dots {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 38px;
      height: 38px;
      font-size: 14px;
      cursor: default;
      border: 1px solid;
      margin-left: -1px;
    }
    .djp-info {
      font-size: 13px;
      white-space: nowrap;
      margin-left: auto;
      padding-left: 16px;
    }

    /* ── Light Theme ── */
    .djp--light .djp-btn {
      background: #fff;
      color: #6b7280;
      border-color: #d1d5db;
    }
    .djp--light .djp-btn:hover:not(:disabled):not(.djp-btn--active) {
      background: #f9fafb;
      color: #111827;
    }
    .djp--light .djp-btn--active {
      background: #3b82f6;
      color: #fff;
      border-color: #3b82f6;
      z-index: 1;
      position: relative;
    }
    .djp--light .djp-btn:disabled {
      color: #d1d5db;
      cursor: not-allowed;
      background: #f9fafb;
    }
    .djp--light .djp-dots {
      color: #9ca3af;
      background: #fff;
      border-color: #d1d5db;
    }
    .djp--light .djp-info {
      color: #6b7280;
    }

    /* ── Dark Theme ── */
    .djp--dark .djp-btn {
      background: #1f2937;
      color: #9ca3af;
      border-color: #374151;
    }
    .djp--dark .djp-btn:hover:not(:disabled):not(.djp-btn--active) {
      background: #374151;
      color: #f3f4f6;
    }
    .djp--dark .djp-btn--active {
      background: #3b82f6;
      color: #fff;
      border-color: #3b82f6;
      z-index: 1;
      position: relative;
    }
    .djp--dark .djp-btn:disabled {
      color: #4b5563;
      cursor: not-allowed;
      background: #111827;
    }
    .djp--dark .djp-dots {
      color: #6b7280;
      background: #1f2937;
      border-color: #374151;
    }
    .djp--dark .djp-info {
      color: #9ca3af;
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

  // Priority 1: state.pagination object
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

  if (last <= 1) {
    container.innerHTML = "";
    return;
  }

  container.dataset.djPaginateMethod = method || "change_page";
  container.dataset.djPaginateKey = key;
  container.dataset.djPaginateIsServer = String(isServer);

  const theme = resolveTheme(container);

  // Build UI
  const wrapper = document.createElement("div");
  wrapper.className = `djp djp--${theme}`;

  const list = document.createElement("div");
  list.className = "djp-list";

  // Prev
  list.appendChild(createBtn("‹", current - 1, current <= 1));

  // Pages with windowing
  const pages = getPageWindow(current, last);
  for (const p of pages) {
    if (p === "...") {
      const dots = document.createElement("span");
      dots.className = "djp-dots";
      dots.textContent = "…";
      list.appendChild(dots);
    } else {
      const btn = createBtn(String(p), p, false);
      if (p === current) btn.classList.add("djp-btn--active");
      list.appendChild(btn);
    }
  }

  // Next
  list.appendChild(createBtn("›", current + 1, current >= last));

  wrapper.appendChild(list);

  // Info
  const info = document.createElement("span");
  info.className = "djp-info";
  const pag = pagination || {};
  const total = pag.total;
  const perPage = pag.per_page;
  if (total != null && perPage != null) {
    const from = (current - 1) * perPage + 1;
    const to = Math.min(current * perPage, total);
    info.textContent = `Showing ${from} to ${to} of ${total}`;
  } else {
    info.textContent = `Page ${current} of ${last}`;
  }
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
