/** @file JSON response envelope builder. */

import { session } from "./session.js";

/**
 * Normalize error entries to { code, message } shape.
 * @param {Array<object|string>} errors
 * @returns {Array<{ code: string, message: string }>}
 */
export function normalizeErrors(errors) {
  if (!Array.isArray(errors)) return [];

  return errors.map((entry) => {
    if (typeof entry === "string") {
      return { code: "ERROR", message: entry };
    }
    return {
      code: entry.code || "ERROR",
      message: entry.message || String(entry)
    };
  });
}

/**
 * Build metrics object for responses.
 * @param {object} [partial]
 * @returns {object}
 */
export function buildMetrics(partial = {}) {
  return {
    generation_time_ms: partial.generation_time_ms ?? 0,
    webhook_time_ms: partial.webhook_time_ms ?? 0,
    total_time_ms: partial.total_time_ms ?? 0,
    stages: partial.stages ?? { ...session.stageTimings }
  };
}

/**
 * Build a consistent JSON response envelope.
 * @param {object} partial
 * @returns {object}
 */
export function createResponse(partial = {}) {
  const success = Boolean(partial.success);
  const base = {
    success,
    request_id: session.requestId,
    job_id: session.jobId || partial.job_id || null,
    timestamp: new Date().toISOString()
  };

  if (!success) {
    return {
      ...base,
      errors: normalizeErrors(partial.errors || [])
    };
  }

  return {
    ...base,
    prompt: partial.prompt ?? "",
    model: partial.model ?? "",
    quality: partial.quality ?? "",
    images: partial.images ?? [],
    metrics: buildMetrics(partial.metrics || {}),
    warnings: partial.warnings ?? [],
    errors: normalizeErrors(partial.errors || []),
    // Make.com / legacy compatibility fields
    progress: session.state,
    provider: partial.provider,
    test_mode: partial.test_mode,
    webhook_delivered: partial.webhook_delivered,
    webhook_attempts: partial.webhook_attempts,
    webhook_error: partial.webhook_error
  };
}

/**
 * Build a failure response with optional context fields.
 * @param {Array<{ code: string, message: string }>} errors
 * @param {object} [context]
 * @returns {object}
 */
export function createFailureResponse(errors, context = {}) {
  return createResponse({
    success: false,
    job_id: context.job_id ?? session.jobId,
    errors
  });
}
