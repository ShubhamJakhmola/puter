/** @file Webhook delivery with retry logic. */

import { DEFAULTS, BRIDGE_VERSION } from "./config.js";
import { session } from "./session.js";
import { log } from "./logger.js";
import { sleep, backoffMs } from "./utils.js";

/**
 * POST JSON payload to webhook with retries and exponential backoff.
 * @param {string} url
 * @param {object} payload
 * @returns {Promise<{ delivered: boolean, attempts: number, error?: string, duration_ms: number }>}
 */
export async function sendWebhook(url, payload) {
  const started = performance.now();
  let lastError = "";

  const body = {
    ...payload,
    request_id: session.requestId,
    job_id: session.jobId || payload.job_id || null
  };

  for (let attempt = 0; attempt < DEFAULTS.webhookRetries; attempt++) {
    try {
      log("INFO", `Webhook delivery attempt ${attempt + 1}/${DEFAULTS.webhookRetries}`, { url });

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": session.requestId,
          "X-Job-Id": session.jobId || "",
          "X-Puter-Bridge": BRIDGE_VERSION
        },
        body: JSON.stringify(body),
        mode: "cors"
      });

      if (!res.ok) {
        throw new Error(`Webhook responded with HTTP ${res.status}`);
      }

      const durationMs = Math.round(performance.now() - started);
      log("SUCCESS", "Webhook delivered", {
        status: res.status,
        attempts: attempt + 1,
        duration_ms: durationMs
      });

      session.stageTimings["Sending Webhook"] = durationMs;
      return { delivered: true, attempts: attempt + 1, duration_ms: durationMs };
    } catch (err) {
      lastError = err?.message || String(err);
      log("ERROR", `Webhook attempt ${attempt + 1} failed: ${lastError}`, {
        attempt: attempt + 1,
        max_attempts: DEFAULTS.webhookRetries
      });

      if (attempt < DEFAULTS.webhookRetries - 1) {
        const delay = backoffMs(attempt);
        log("WARNING", `Webhook retry scheduled in ${delay}ms`, {
          next_attempt: attempt + 2,
          backoff_ms: delay
        });
        await sleep(delay);
      }
    }
  }

  const durationMs = Math.round(performance.now() - started);
  session.stageTimings["Sending Webhook"] = durationMs;

  log("ERROR", "Webhook delivery exhausted all retries", {
    attempts: DEFAULTS.webhookRetries,
    duration_ms: durationMs,
    error: lastError
  });

  return {
    delivered: false,
    attempts: DEFAULTS.webhookRetries,
    error: lastError,
    duration_ms: durationMs
  };
}
