/**
 * djact/app.js  — v1.1.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Djact client-side engine.
 *
 * Public API
 * ──────────
 *   createDjactApp({ resolve, onStart?, onFinish?, onError? })
 *   djactVisit(url, options?)
 *   Link
 *   useDjactPage()
 *   useDjactLoading()
 *
 * Peer dependencies (supplied by host project)
 * ─────────────────────────────────────────────
 *   react     ≥ 18
 *   react-dom ≥ 18
 *
 * Component naming
 * ────────────────
 *   Djact does not enforce a naming convention or folder structure. 
 *   The string you pass to `djact_render` in Django is passed verbatim 
 *   to your `resolve` function here.
 *
 *   Examples:
 *     Django: djact_render(request, "Home") 
 *     JS: resolve("Home")
 *
 *     Django: djact_render(request, "Admin/Settings")
 *     JS: resolve("Admin/Settings")
 *
 *   You decide how to map these strings to files in your project.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  memo,
} from "react";
import { createRoot } from "react-dom/client";

// ─── Internal singleton state ─────────────────────────────────────────────────

/** Single React root — created once, reused for every navigation. */
let _root = null;

/**
 * Current page: { Component, componentName, props, url }
 * `componentName` is kept so popstate can skip a redundant re-resolve.
 */
let _page = null;

/** User-supplied resolver: (name: string) → Component | Promise<Component> */
let _resolve = null;

/** Registered page-change listeners (used by DjactApp + useDjactPage). */
const _pageListeners = new Set();

/** Registered loading-state listeners (used by useDjactLoading). */
const _loadingListeners = new Set();

/** Guard against concurrent navigations to the same URL. */
let _inflight = null;

/** Resolved-component LRU cache — avoids re-importing the same module. */
const _componentCache = new Map();
const _CACHE_MAX = 50;

// ─── CSRF ─────────────────────────────────────────────────────────────────────

/**
 * Read the CSRF token from <meta name="csrf-token"> (injected by djact.html)
 * with a fallback to the `csrftoken` cookie (standard Django behaviour).
 *
 * @returns {string}
 */
function getCsrfToken() {
  // 1. Meta tag (preferred — always present on Djact pages).
  const meta = document.querySelector('meta[name="csrf-token"]');
  if (meta) return meta.getAttribute("content") ?? "";

  // 2. Cookie fallback (useful when the template is overridden).
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

// ─── Loading state ────────────────────────────────────────────────────────────

function _setLoading(value) {
  _loadingListeners.forEach((fn) => fn(value));
}

// ─── Component resolution + cache ─────────────────────────────────────────────

/**
 * Resolve a component name → React component type.
 *
 * Results are cached (LRU eviction at _CACHE_MAX entries) so repeated
 * navigations to the same page do not re-execute the dynamic import.
 *
 * Supports multi-app names like "library/Dashboard" or "student/Profile" —
 * the name is passed verbatim to the host project's `resolve` function.
 *
 * @param {string} name
 * @returns {Promise<React.ComponentType>}
 */
async function resolveComponent(name) {
  if (!_resolve) {
    throw new Error("[Djact] createDjactApp() has not been called yet.");
  }

  if (_componentCache.has(name)) {
    return _componentCache.get(name);
  }

  const mod = await Promise.resolve(_resolve(name));

  // Support `export default` and re-exported default patterns.
  const Component =
    mod && typeof mod === "object" && "default" in mod ? mod.default : mod;

  if (typeof Component !== "function") {
    throw new Error(
      `[Djact] resolve("${name}") did not return a React component. ` +
        `Got: ${typeof Component}`
    );
  }

  // Cache with simple LRU eviction.
  if (_componentCache.size >= _CACHE_MAX) {
    _componentCache.delete(_componentCache.keys().next().value);
  }
  _componentCache.set(name, Component);

  return Component;
}

// ─── Internal page state ──────────────────────────────────────────────────────

/**
 * Update internal page state and notify all subscribed listeners.
 * Skips the update (no-op) if the component name, props, and URL are
 * all identical to the current page — preventing redundant re-renders.
 *
 * @param {React.ComponentType} Component
 * @param {string}              componentName  The raw name string from Django.
 * @param {object}              props
 * @param {string}              url
 */
function _setPage(Component, componentName, props, url) {
  // Shallow-equality guard — skip if nothing actually changed.
  if (
    _page &&
    _page.componentName === componentName &&
    _page.url === url &&
    _shallowEqual(_page.props, props)
  ) {
    return;
  }

  _page = { Component, componentName, props, url };
  _pageListeners.forEach((fn) => fn(_page));
}

/** Shallow-equal two plain objects. */
function _shallowEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  const keysA = Object.keys(a);
  if (keysA.length !== Object.keys(b).length) return false;
  return keysA.every((k) => a[k] === b[k]);
}

// ─── Navigation ───────────────────────────────────────────────────────────────

/**
 * djactVisit(url, options?)
 *
 * Perform a client-side Djact navigation.
 *
 * @param {string}  url
 * @param {object}  [options]
 * @param {boolean} [options.replace=false]  Replace history entry instead of push.
 * @param {object}  [options.data={}]        Extra props merged onto server props.
 * @param {boolean} [options.forceReload=false]  Bypass in-flight dedup guard.
 * @returns {Promise<void>}
 */
export async function djactVisit(
  url,
  { replace = false, data = {}, forceReload = false } = {}
) {
  // ── Deduplicate concurrent requests to the same URL ──────────────────────
  if (!forceReload && _inflight === url) {
    return;
  }
  _inflight = url;
  _setLoading(true);

  let payload;

  try {
    const response = await fetch(url, {
      headers: {
        "X-Djact": "true",
        "X-CSRFToken": getCsrfToken(),
        Accept: "application/json",
      },
      credentials: "same-origin",
    });

    // ── Graceful HTTP error handling ─────────────────────────────────────
    if (!response.ok) {
      const status = response.status;
      console.error(
        `[Djact] Navigation to "${url}" failed — HTTP ${status}.`
      );

      if (status === 404 || status >= 500) {
        // Hard reload so Django's own error pages are shown.
        window.location.href = url;
        return;
      }

      // For 3xx / 4xx (e.g. 401 login redirect), follow via hard nav.
      const location = response.headers.get("Location");
      window.location.href = location || url;
      return;
    }

    payload = await response.json();
  } catch (err) {
    // ── Network-level error (offline, CORS, timeout) ─────────────────────
    console.error("[Djact] Network error during navigation:", err);
    window.location.href = url;
    return;
  } finally {
    _inflight = null;
    _setLoading(false);
  }

  const { component: name, props = {}, url: resolvedUrl } = payload;
  const mergedProps = { ...props, ...data };

  let Component;
  try {
    Component = await resolveComponent(name);
  } catch (err) {
    console.error(`[Djact] Could not resolve component "${name}":`, err);
    // Render an inline error boundary rather than going blank.
    _setPage(_NotFound, name, { componentName: name }, resolvedUrl || url);
    return;
  }

  const historyUrl = resolvedUrl || url;

  if (replace) {
    window.history.replaceState(
      { djact: true, component: name, props: mergedProps },
      "",
      historyUrl
    );
  } else {
    window.history.pushState(
      { djact: true, component: name, props: mergedProps },
      "",
      historyUrl
    );
  }

  _setPage(Component, name, mergedProps, historyUrl);
}

// ─── Built-in fallback components ─────────────────────────────────────────────

/**
 * Shown when a component name cannot be resolved.
 * Styled minimally so it is visible but unobtrusive.
 */
function _NotFound({ componentName }) {
  return React.createElement(
    "div",
    {
      style: {
        padding: "2rem",
        fontFamily: "monospace",
        color: "#c0392b",
        background: "#fff5f5",
        border: "1px solid #f5c6cb",
        borderRadius: "4px",
        margin: "1rem",
      },
    },
    React.createElement("strong", null, "[Djact] Component not found: "),
    componentName
  );
}

// ─── Root React component ─────────────────────────────────────────────────────

/**
 * DjactApp — mounted once, drives all page transitions.
 *
 * Uses `memo` so React can bail out of reconciliation when the parent
 * (createRoot) triggers a synthetic re-render.
 */
const DjactApp = memo(function DjactApp({ initialPage }) {
  const [page, setPage] = useState(initialPage);
  // Track previous component name to log transitions in dev.
  const prevNameRef = useRef(initialPage?.componentName);

  useEffect(() => {
    _pageListeners.add(setPage);
    return () => _pageListeners.delete(setPage);
  }, []);

  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" &&
      page?.componentName !== prevNameRef.current
    ) {
      console.debug(
        `[Djact] ${prevNameRef.current} → ${page?.componentName} (${page?.url})`
      );
      prevNameRef.current = page?.componentName;
    }
  }, [page]);

  if (!page?.Component) return null;

  const { Component, props } = page;
  return React.createElement(Component, props);
});

// ─── Bootstrap ────────────────────────────────────────────────────────────────

/**
 * createDjactApp({ resolve, onStart?, onFinish?, onError? })
 *
 * Bootstrap the Djact client. Call exactly once at your entry point.
 *
 * @param {object}    options
 * @param {Function}  options.resolve              Maps component name → component.
 * @param {Function}  [options.onStart]            Called before every navigation.
 * @param {Function}  [options.onFinish]           Called after every navigation.
 * @param {Function}  [options.onError]            Called on unrecoverable errors.
 * @returns {Promise<void>}
 */
export async function createDjactApp({
  resolve,
  onStart,
  onFinish,
  onError,
} = {}) {
  if (!resolve || typeof resolve !== "function") {
    throw new Error("[Djact] createDjactApp() requires a `resolve` function.");
  }

  _resolve = resolve;

  // Wire up optional lifecycle hooks to the loading state broadcaster.
  if (onStart || onFinish) {
    _loadingListeners.add((isLoading) => {
      if (isLoading && onStart) onStart();
      if (!isLoading && onFinish) onFinish();
    });
  }

  // ── Read initial page data from the DOM ──────────────────────────────────
  const container = document.getElementById("app");
  if (!container) {
    const msg = '[Djact] Mount point <div id="app"> not found.';
    console.error(msg);
    if (onError) onError(new Error(msg));
    return;
  }

  const rawPageData = container.dataset.page;
  if (!rawPageData) {
    const msg = "[Djact] data-page attribute is missing or empty on #app.";
    console.error(msg);
    if (onError) onError(new Error(msg));
    return;
  }

  let pageData;
  try {
    pageData = JSON.parse(rawPageData);
  } catch (err) {
    console.error("[Djact] Failed to parse data-page JSON:", err);
    if (onError) onError(err);
    return;
  }

  const {
    component: name,
    props = {},
    url = window.location.pathname,
  } = pageData;

  // ── Resolve initial component ────────────────────────────────────────────
  let Component;
  try {
    Component = await resolveComponent(name);
  } catch (err) {
    console.error(`[Djact] Could not resolve initial component "${name}":`, err);
    if (onError) onError(err);
    Component = _NotFound;
  }

  // ── Stamp initial history state ──────────────────────────────────────────
  window.history.replaceState(
    { djact: true, component: name, props },
    "",
    url
  );

  _page = { Component, componentName: name, props, url };

  // ── Mount React 18 root ──────────────────────────────────────────────────
  _root = createRoot(container);
  _root.render(React.createElement(DjactApp, { initialPage: _page }));

  // ── popstate (browser back / forward) ───────────────────────────────────
  window.addEventListener("popstate", async (event) => {
    const state = event.state;

    if (state?.djact) {
      // History state already carries component + props — no network round-trip.
      let PopComponent;
      try {
        PopComponent = await resolveComponent(state.component);
      } catch (err) {
        console.error(
          `[Djact] popstate: could not resolve "${state.component}":`,
          err
        );
        PopComponent = _NotFound;
      }
      _setPage(
        PopComponent,
        state.component,
        state.props,
        window.location.pathname + window.location.search
      );
    } else {
      // Non-Djact history entry — do a fresh XHR fetch.
      await djactVisit(window.location.href, { replace: true });
    }
  });
}

// ─── Link component ───────────────────────────────────────────────────────────

/**
 * <Link> — SPA-style anchor with active-class, replace-mode, and prefetch.
 *
 * @param {object}         props
 * @param {string}         props.href              Destination URL.
 * @param {React.ReactNode} props.children         Link content.
 * @param {string}         [props.className]       Base CSS class.
 * @param {string}         [props.activeClassName] Class added when href matches current URL.
 * @param {boolean}        [props.replace]         Replace history instead of push.
 * @param {boolean}        [props.prefetch]        Prefetch on hover (resolves + caches component).
 * @param {Function}       [props.onClick]         Extra click handler (runs before navigation).
 * @param {object}         [props.data]            Extra props merged into server props.
 * @param {*}              [props.*]               Forwarded to the underlying <a>.
 *
 * @returns {React.ReactElement}
 */
export function Link({
  href,
  children,
  className,
  activeClassName = "active",
  replace = false,
  prefetch = false,
  onClick,
  data = {},
  ...rest
}) {
  // ── Active state ─────────────────────────────────────────────────────────
  const [page, setPage] = useState(_page);

  useEffect(() => {
    _pageListeners.add(setPage);
    return () => _pageListeners.delete(setPage);
  }, []);

  const isActive =
    page?.url === href ||
    (href !== "/" && page?.url?.startsWith(href));

  const computedClass = [
    className,
    isActive && activeClassName ? activeClassName : "",
  ]
    .filter(Boolean)
    .join(" ") || undefined;

  // ── Prefetch on hover ────────────────────────────────────────────────────
  const handleMouseEnter = useCallback(() => {
    if (!prefetch) return;
    // Fire-and-forget: warms up the component cache only.
    fetch(href, {
      headers: { "X-Djact": "true", Accept: "application/json" },
      credentials: "same-origin",
    })
      .then((r) => r.json())
      .then((payload) => resolveComponent(payload.component))
      .catch(() => {}); // Prefetch failures are silent.
  }, [href, prefetch]);

  // ── Click handler ────────────────────────────────────────────────────────
  const handleClick = useCallback(
    (event) => {
      // Let modifier-key clicks (Cmd/Ctrl/Shift/Alt) behave natively.
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      if (onClick) {
        onClick(event);
        if (event.defaultPrevented) return;
      }

      event.preventDefault();
      djactVisit(href, { replace, data });
    },
    [href, replace, data, onClick]
  );

  return React.createElement(
    "a",
    {
      href,
      className: computedClass,
      onClick: handleClick,
      onMouseEnter: prefetch ? handleMouseEnter : undefined,
      "aria-current": isActive ? "page" : undefined,
      ...rest,
    },
    children
  );
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * useDjactPage()
 *
 * Returns the current page object: { Component, componentName, props, url }
 *
 * @returns {{ Component: React.ComponentType, componentName: string, props: object, url: string }}
 */
export function useDjactPage() {
  const [page, setPage] = useState(_page);

  useEffect(() => {
    _pageListeners.add(setPage);
    return () => _pageListeners.delete(setPage);
  }, []);

  return page;
}

/**
 * useDjactLoading()
 *
 * Returns `true` while a navigation fetch is in progress, `false` otherwise.
 * Use to show a progress bar or spinner.
 *
 * @returns {boolean}
 */
export function useDjactLoading() {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    _loadingListeners.add(setLoading);
    return () => _loadingListeners.delete(setLoading);
  }, []);

  return loading;
}
