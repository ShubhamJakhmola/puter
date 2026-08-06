/** @file Shared utility helpers. */

/**
 * Sleep for ms milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run a promise with a timeout; rejects on expiry.
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} label
 * @returns {Promise<T>}
 */
export function withTimeout(promise, ms, label) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

/**
 * Exponential backoff delay for retry attempt (0-indexed).
 * @param {number} attempt
 * @returns {number}
 */
export function backoffMs(attempt) {
  return Math.min(8000, 1000 * Math.pow(2, attempt));
}

/**
 * Parse a boolean-like URL/query value.
 * @param {string|null|undefined} value
 * @param {boolean} fallback
 * @returns {boolean}
 */
export function parseBool(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  const v = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(v)) return true;
  if (["0", "false", "no", "off"].includes(v)) return false;
  return fallback;
}

/**
 * Parse positive integer with bounds.
 * @param {string|null|undefined} value
 * @param {number} fallback
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function parseIntBounded(value, fallback, min, max) {
  const n = parseInt(String(value ?? ""), 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Determine if an error is likely retryable.
 * @param {Error|unknown} err
 * @returns {boolean}
 */
export function isRetryableError(err) {
  const msg = (err && err.message ? err.message : String(err)).toLowerCase();
  const retryable = [
    "network", "timeout", "timed out", "fetch",
    "503", "502", "504", "429", "rate", "temporarily", "econnreset", "socket"
  ];
  const fatal = ["invalid", "unauthorized", "forbidden", "authentication", "auth", "permission", "empty prompt"];
  if (fatal.some((k) => msg.includes(k))) return false;
  return retryable.some((k) => msg.includes(k));
}

/**
 * @param {string} iso
 * @returns {string}
 */
export function formatTime(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

/**
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
