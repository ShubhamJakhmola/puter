/** @file Per-request session state. */

/** @type {{ requestId: string|null, state: string, response: object|null }} */
export const session = {
  requestId: null,
  state: "Initializing",
  response: null
};

/**
 * Generate a UUID v4 request identifier.
 * @returns {string}
 */
export function createRequestId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "req-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}
