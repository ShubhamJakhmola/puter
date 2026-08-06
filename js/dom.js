/** @file DOM element references. */

/** @type {Record<string, HTMLElement|null>} */
export const dom = {};

/**
 * Cache all required DOM nodes after document is ready.
 */
export function initDom() {
  const ids = [
    "app", "headless-panel", "headless-status", "preview-panel", "result-panel",
    "result-status", "meta-grid", "error-box", "gallery", "json-output",
    "copy-json", "history-list", "manual-prompt", "manual-model", "manual-quality",
    "manual-count", "manual-test", "manual-generate", "manual-status"
  ];

  ids.forEach((id) => {
    const key = id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    dom[key] = document.getElementById(id);
  });
}
