/** @file Structured logging and progress tracking. */

import { PROGRESS_STATES } from "./config.js";
import { session } from "./session.js";
import { dom } from "./dom.js";

/**
 * Structured console logger.
 * @param {"INFO"|"WARNING"|"ERROR"|"SUCCESS"} level
 * @param {string} message
 * @param {object} [meta]
 */
export function log(level, message, meta) {
  const id = session.requestId || "no-request";
  const prefix = `[${level}] [${id}] ${message}`;
  const payload = meta ? { ...meta, request_id: id } : { request_id: id };

  switch (level) {
    case "ERROR": console.error(prefix, payload); break;
    case "WARNING": console.warn(prefix, payload); break;
    case "SUCCESS": console.info(prefix, payload); break;
    default: console.info(prefix, payload);
  }
}

/**
 * Update internal progress state and log it.
 * @param {string} state
 */
export function setProgress(state) {
  if (!PROGRESS_STATES.includes(state)) {
    log("WARNING", `Unknown progress state: ${state}`);
  }
  session.state = state;
  log("INFO", `Progress → ${state}`);

  if (dom.headlessStatus && dom.headlessPanel && !dom.headlessPanel.hidden) {
    dom.headlessStatus.textContent = state + "…";
  }
}
