/** @file Structured logging and progress tracking. */

import { PROGRESS_STATES } from "./config.js";
import { session } from "./session.js";
import { dom } from "./dom.js";

/**
 * ISO timestamp for log entries.
 * @returns {string}
 */
function timestamp() {
  return new Date().toISOString();
}

/**
 * Structured console logger with request_id and timestamps.
 * @param {"INFO"|"WARNING"|"ERROR"|"SUCCESS"} level
 * @param {string} message
 * @param {object} [meta]
 */
export function log(level, message, meta) {
  const id = session.requestId || "no-request";
  const ts = timestamp();
  const prefix = `[${level}] [${ts}] [${id}] ${message}`;
  const payload = {
    request_id: id,
    job_id: session.jobId || null,
    timestamp: ts,
    ...(meta || {})
  };

  switch (level) {
    case "ERROR": console.error(prefix, payload); break;
    case "WARNING": console.warn(prefix, payload); break;
    case "SUCCESS": console.info(prefix, payload); break;
    default: console.info(prefix, payload);
  }
}

/**
 * Begin timing a pipeline stage.
 * @param {string} stage
 */
export function startStage(stage) {
  if (session.currentStage) {
    endStage(session.currentStage);
  }

  session.currentStage = stage;
  session.stageStart = performance.now();
  log("INFO", `Stage started: ${stage}`);
}

/**
 * End timing for a pipeline stage and record duration.
 * @param {string} [stage]
 * @returns {number} duration in ms
 */
export function endStage(stage) {
  const stageName = stage || session.currentStage;
  if (!stageName || session.stageStart == null) return 0;

  const durationMs = Math.round(performance.now() - session.stageStart);
  session.stageTimings[stageName] = durationMs;
  log("INFO", `Stage completed: ${stageName}`, { duration_ms: durationMs });

  if (session.currentStage === stageName) {
    session.currentStage = null;
    session.stageStart = null;
  }

  return durationMs;
}

/**
 * Update internal progress state, log it, and track stage timing.
 * @param {string} state
 */
export function setProgress(state) {
  if (!PROGRESS_STATES.includes(state)) {
    log("WARNING", `Unknown progress state: ${state}`);
  }

  if (session.currentStage && session.currentStage !== state) {
    endStage(session.currentStage);
  }

  session.state = state;
  log("INFO", `Progress → ${state}`);

  const terminal = state === "Completed" || state === "Failed";
  if (terminal) {
    if (session.currentStage) endStage(session.currentStage);
  } else {
    session.currentStage = state;
    session.stageStart = performance.now();
    log("INFO", `Stage started: ${state}`);
  }

  if (dom.headlessStatus && dom.headlessPanel && !dom.headlessPanel.hidden) {
    dom.headlessStatus.textContent = state + "…";
  }
}
