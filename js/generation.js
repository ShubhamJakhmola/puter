/** @file Puter.ai image generation with retry logic. */

import { DEFAULTS } from "./config.js";
import { log, setProgress } from "./logger.js";
import { sleep, backoffMs, isRetryableError } from "./utils.js";

/**
 * Wait until Puter SDK is available.
 * @param {number} maxWaitMs
 * @returns {Promise<void>}
 */
export async function waitForPuter(maxWaitMs) {
  const start = Date.now();
  while (typeof puter === "undefined" || !puter?.ai?.txt2img) {
    if (Date.now() - start > maxWaitMs) {
      throw new Error("Puter.js SDK failed to load.");
    }
    await sleep(100);
  }
}

/**
 * Extract image dimensions and data URL from an HTMLImageElement.
 * @param {HTMLImageElement} imgEl
 * @param {number} index
 * @param {object} config
 * @param {number} durationMs
 * @returns {Promise<object>}
 */
export function buildImageMeta(imgEl, index, config, durationMs) {
  return new Promise((resolve) => {
    const finish = () => {
      resolve({
        index,
        url: imgEl.src,
        width: imgEl.naturalWidth || imgEl.width || null,
        height: imgEl.naturalHeight || imgEl.height || null,
        model: config.model,
        provider: config.provider,
        quality: config.quality,
        generation_duration_ms: durationMs,
        created_at: new Date().toISOString()
      });
    };

    if (imgEl.complete) finish();
    else {
      imgEl.onload = finish;
      imgEl.onerror = finish;
    }
  });
}

/**
 * Generate a single image via Puter with retry logic.
 * @param {string} prompt
 * @param {object} config
 * @param {number} index
 * @returns {Promise<object>}
 */
export async function generateSingleImage(prompt, config, index) {
  const options = {
    provider: config.provider,
    model: config.model,
    quality: config.quality,
    test_mode: config.test_mode
  };

  let lastError;

  for (let attempt = 0; attempt < DEFAULTS.maxRetries; attempt++) {
    const start = performance.now();
    try {
      log("INFO", `Generating image ${index + 1}/${config.count}`, { attempt: attempt + 1 });

      const imgEl = await puter.ai.txt2img(prompt, options);
      if (!imgEl || !imgEl.src) {
        throw new Error("Puter returned an empty image element.");
      }

      const durationMs = Math.round(performance.now() - start);
      const meta = await buildImageMeta(imgEl, index, config, durationMs);
      log("SUCCESS", `Image ${index + 1} generated`, { duration_ms: durationMs });
      return meta;
    } catch (err) {
      lastError = err;
      const retryable = isRetryableError(err) && attempt < DEFAULTS.maxRetries - 1;
      log("ERROR", `Image ${index + 1} attempt ${attempt + 1} failed: ${err.message}`, { retryable });

      if (!retryable) break;
      const delay = backoffMs(attempt);
      log("WARNING", `Retrying in ${delay}ms…`);
      await sleep(delay);
    }
  }

  throw lastError || new Error("Unknown generation failure.");
}

/**
 * Generate multiple images sequentially.
 * @param {object} config
 * @returns {Promise<{ images: object[], errors: object[], warnings: string[] }>}
 */
export async function generateImages(config) {
  setProgress("Generating");
  /** @type {object[]} */
  const images = [];
  /** @type {object[]} */
  const errors = [];
  const warnings = [...(config.warnings || [])];

  for (let i = 0; i < config.count; i++) {
    try {
      images.push(await generateSingleImage(config.prompt, config, i));
    } catch (err) {
      errors.push({
        index: i,
        message: err?.message || String(err),
        retryable: isRetryableError(err)
      });
    }
  }

  return { images, errors, warnings };
}
