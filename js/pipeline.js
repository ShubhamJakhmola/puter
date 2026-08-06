/** @file Main request pipeline orchestration. */

import { DEFAULTS } from "./config.js";
import { session, createRequestId } from "./session.js";
import { log, setProgress } from "./logger.js";
import { sanitizePrompt, validateConfig } from "./params.js";
import { createResponse } from "./response.js";
import { withTimeout } from "./utils.js";
import { waitForPuter, generateImages } from "./generation.js";
import { sendWebhook } from "./webhook.js";
import { saveHistory } from "./history.js";

/**
 * Main request pipeline.
 * @param {object} rawConfig
 * @returns {Promise<object>}
 */
export async function runPipeline(rawConfig) {
  session.requestId = createRequestId();
  setProgress("Initializing");

  const started = performance.now();
  let response = createResponse({ success: false });

  try {
    setProgress("Reading parameters");

    const sanitized = sanitizePrompt(rawConfig.prompt);
    if (!sanitized.valid) {
      response = createResponse({
        success: false,
        errors: [{ code: "EMPTY_PROMPT", message: sanitized.error }]
      });
      setProgress("Failed");
      return response;
    }

    const config = { ...rawConfig, prompt: sanitized.prompt };
    const validation = validateConfig(config);
    config.warnings = validation.warnings;

    if (!validation.valid) {
      response = createResponse({
        success: false,
        prompt: config.prompt,
        provider: config.provider,
        model: config.model,
        quality: config.quality,
        test_mode: config.test_mode,
        errors: validation.errors.map((m) => ({ code: "VALIDATION", message: m })),
        warnings: validation.warnings
      });
      setProgress("Failed");
      return response;
    }

    setProgress("Authenticating");
    await waitForPuter(15000);

    const genResult = await withTimeout(
      generateImages(config),
      config.timeout,
      "Image generation"
    );

    const success = genResult.images.length > 0;
    response = createResponse({
      success,
      prompt: config.prompt,
      provider: config.provider,
      model: config.model,
      quality: config.quality,
      test_mode: config.test_mode,
      generation_time: Math.round(performance.now() - started),
      image_count: genResult.images.length,
      images: genResult.images,
      errors: genResult.errors,
      warnings: genResult.warnings
    });

    if (config.webhook) {
      setProgress("Uploading");
      const webhookResult = await sendWebhook(config.webhook, response);
      if (!webhookResult.delivered) {
        response.warnings = [
          ...(response.warnings || []),
          `Webhook delivery failed after ${webhookResult.attempts} attempts.`
        ];
        response.webhook_error = webhookResult.error;
        response.webhook_delivered = false;
      } else {
        response.webhook_delivered = true;
        response.webhook_attempts = webhookResult.attempts;
      }
    }

    setProgress(success ? "Completed" : "Failed");
    if (success) saveHistory(response);
    return response;
  } catch (err) {
    const isTimeout = String(err.message).toLowerCase().includes("timed out");
    log("ERROR", `Pipeline failed: ${err.message}`);

    response = createResponse({
      success: false,
      prompt: rawConfig.prompt || "",
      provider: rawConfig.provider || DEFAULTS.provider,
      model: rawConfig.model || DEFAULTS.model,
      quality: rawConfig.quality || DEFAULTS.quality,
      test_mode: rawConfig.test_mode ?? DEFAULTS.test_mode,
      generation_time: Math.round(performance.now() - started),
      image_count: 0,
      images: [],
      errors: [{
        code: isTimeout ? "TIMEOUT" : "GENERATION_FAILURE",
        message: err.message
      }],
      warnings: rawConfig.warnings || []
    });

    if (rawConfig.webhook) {
      try {
        await sendWebhook(rawConfig.webhook, response);
      } catch (whErr) {
        log("WARNING", "Failed to send error webhook", { error: whErr.message });
      }
    }

    setProgress("Failed");
    return response;
  }
}
