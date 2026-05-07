/**
 * djact/api.js — Server communication layer.
 *
 * Reads the endpoint URL from <meta name="djact-url"> so it's
 * never hardcoded.  Every call includes the component name.
 * Hooks into debug panel for request tracking.
 */
import { logRequest, logError, isDebugEnabled } from "./debug.js";

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
  const requestBody = { component, method, data };
  const startTime = performance.now();
  const debug = isDebugEnabled();

  let status = 0;
  let responseData = null;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCsrfToken(),
      },
      credentials: "same-origin",
      body: JSON.stringify(requestBody),
    });

    status = response.status;
    const body = await response.json().catch(() => ({}));
    responseData = body;

    if (!response.ok) {
      const msg = body.error || `Server error ${response.status}`;
      const err = new Error(msg);

      if (debug) {
        logError({
          type: "server",
          message: `${component}.${method}() → ${status}: ${msg}`,
          source: url,
          time: new Date().toLocaleTimeString(),
        });
      }

      throw err;
    }

    return body;

  } catch (err) {
    if (debug && status === 0) {
      logError({
        type: "network",
        message: err.message,
        source: url,
        time: new Date().toLocaleTimeString(),
      });
    }
    throw err;

  } finally {
    if (debug) {
      const latency = Math.round(performance.now() - startTime);
      logRequest({
        component,
        method,
        url,
        status,
        latency,
        request: requestBody,
        response: responseData,
        time: new Date().toLocaleTimeString(),
      });
    }
  }
}
