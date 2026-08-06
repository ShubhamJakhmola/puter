/** @file Per-request session state. */

/** In-memory registry for future duplicate job detection. */
const processedJobIds = new Set();

/** @type {{
 *   requestId: string|null,
 *   jobId: string|null,
 *   state: string,
 *   response: object|null,
 *   stageTimings: Record<string, number>,
 *   currentStage: string|null,
 *   stageStart: number|null,
 *   pipelineStart: number|null
 * }} */
export const session = {
  requestId: null,
  jobId: null,
  state: "Initializing",
  response: null,
  stageTimings: {},
  currentStage: null,
  stageStart: null,
  pipelineStart: null
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

/**
 * Reset per-request session fields before a new pipeline run.
 * @param {string|null} [jobId]
 */
export function resetSession(jobId = null) {
  session.requestId = createRequestId();
  session.jobId = jobId || null;
  session.state = "Initializing";
  session.response = null;
  session.stageTimings = {};
  session.currentStage = null;
  session.stageStart = null;
  session.pipelineStart = performance.now();
}

/**
 * Check whether a job_id was already processed (stub for future duplicate detection).
 * @param {string|null|undefined} jobId
 * @returns {{ duplicate: boolean, job_id: string|null }}
 */
export function checkJobDuplicate(jobId) {
  if (!jobId) {
    return { duplicate: false, job_id: null };
  }

  const normalized = String(jobId).trim();
  if (!normalized) {
    return { duplicate: false, job_id: null };
  }

  // Future: enable duplicate rejection once Make.com idempotency is wired up.
  if (processedJobIds.has(normalized)) {
    return { duplicate: true, job_id: normalized };
  }

  return { duplicate: false, job_id: normalized };
}

/**
 * Register a job_id after successful processing (stub for future duplicate detection).
 * @param {string|null|undefined} jobId
 */
export function registerJobId(jobId) {
  const normalized = jobId ? String(jobId).trim() : "";
  if (normalized) {
    processedJobIds.add(normalized);
  }
}
