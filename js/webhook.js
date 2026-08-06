/** @file Webhook delivery with retry logic. */

import { DEFAULTS, BRIDGE_VERSION } from "./config.js";
import { session } from "./session.js";
import { log, setProgress } from "./logger.js";
import { sleep, backoffMs } from "./utils.js";

/**
 * POST JSON payload to webhook with retries.
 * @param {string} url
 * @param {object} payload
 * @returns {Promise<{ delivered: boolean, attempts: number, error?: string }>}
 */
export async function sendWebhook(url, payload) {
  setProgress("Webhook");
  let lastError = "";

  for (let attempt = 0; attempt < DEFAULTS.webhookRetries; attempt++) {
    try {
      log("INFO", `Webhook delivery attempt ${attempt + 1}`, { url });

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": session.requestId,
          "X-Puter-Bridge": BRIDGE_VERSION
        },
        body: JSON.stringify(payload),
        mode: "cors"
      });

      if (!res.ok) {
        throw new Error(`Webhook responded with HTTP ${res.status}`);
      }

      log("SUCCESS", "Webhook delivered", { status: res.status, attempts: attempt + 1 });
      return { delivered: true, attempts: attempt + 1 };
    } catch (err) {
      lastError = err?.message || String(err);
      log("ERROR", `Webhook attempt ${attempt + 1} failed: ${lastError}`);
      if (attempt < DEFAULTS.webhookRetries - 1) {
        await sleep(backoffMs(attempt));
      }
    }
  }

  return { delivered: false, attempts: DEFAULTS.webhookRetries, error: lastError };
}
