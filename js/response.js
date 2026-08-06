/** @file JSON response envelope builder. */

import { DEFAULTS } from "./config.js";
import { session } from "./session.js";

/**
 * Build a consistent JSON response envelope.
 * @param {object} partial
 * @returns {object}
 */
export function createResponse(partial) {
  return {
    success: false,
    request_id: session.requestId,
    timestamp: new Date().toISOString(),
    prompt: "",
    provider: DEFAULTS.provider,
    model: DEFAULTS.model,
    quality: DEFAULTS.quality,
    test_mode: false,
    generation_time: 0,
    image_count: 0,
    images: [],
    errors: [],
    warnings: [],
    progress: session.state,
    ...partial
  };
}
