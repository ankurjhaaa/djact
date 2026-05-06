/**
 * djact/api.js — Server communication layer.
 *
 * Reads the endpoint URL from <meta name="djact-url"> so it's
 * never hardcoded.  Every call includes the component name.
 */

let _endpointUrl = null;

function getEndpointUrl() {
  if (_endpointUrl) return _endpointUrl;
  const meta = document.querySelector('meta[name="djact-url"]');
  _endpointUrl = meta ? meta.getAttribute("content") || "/djact/" : "/djact/";
  return _endpointUrl;
}

function getCsrfToken() {
  const meta = document.querySelector('meta[name="csrf-token"]');
  if (meta) return meta.getAttribute("content") || "";
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

/**
 * Call a server method on a specific component.
 *
 * @param {string} component — component name (e.g. "todo")
 * @param {string} method    — function name (e.g. "add_task")
 * @param {object} data      — current state + form data
 * @returns {Promise<object>} — state updates from server
 */
export async function callServer(component, method, data) {
  const url = getEndpointUrl();

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCsrfToken(),
    },
    credentials: "same-origin",
    body: JSON.stringify({ component, method, data }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const msg = body.error || `Server error ${response.status}`;
    throw new Error(msg);
  }

  return response.json();
}
