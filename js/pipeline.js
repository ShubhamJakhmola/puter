/** @file Main request pipeline orchestration. */

import { session, resetSession, checkJobDuplicate, registerJobId } from "./session.js";
import { log, setProgress, endStage } from "./logger.js";
import { validateRequest } from "./params.js";
import { createResponse, createFailureResponse } from "./response.js";
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
  resetSession(rawConfig.job_id || null);
  setProgress("Initializing");

  let webhookTimeMs = 0;

  try {
    setProgress("Validating");

    const jobCheck = checkJobDuplicate(rawConfig.job_id);
    if (jobCheck.duplicate) {
      const response = createFailureResponse([
        {
          code: "DUPLICATE_JOB",
          message: `job_id "${jobCheck.job_id}" was already processed in this session.`
        }
      ]);
      setProgress("Failed");
      return response;
    }

    const validation = validateRequest({
      ...rawConfig,
      rawCount: rawConfig.rawCount ?? rawConfig.count
    });

    if (!validation.valid) {
      const response = createFailureResponse(validation.errors);
      setProgress("Failed");
      return response;
    }

    const config = { ...validation.config, warnings: validation.warnings };

    setProgress("Authenticating");
    const authStart = performance.now();
    await waitForPuter(15000);
    session.stageTimings["Authenticating"] = Math.round(performance.now() - authStart);
    log("INFO", "Puter SDK ready", { duration_ms: session.stageTimings["Authenticating"] });

    const genStart = performance.now();
    const genResult = await withTimeout(
      generateImages(config),
      config.timeout,
      "Image generation"
    );
    const generationTimeMs = Math.round(performance.now() - genStart);

    const success = genResult.images.length > 0;
    const totalTimeMs = Math.round(performance.now() - (session.pipelineStart || genStart));

    let response = createResponse({
      success,
      prompt: config.prompt,
      model: config.model,
      quality: config.quality,
      provider: config.provider,
      test_mode: config.test_mode,
      images: genResult.images,
      warnings: genResult.warnings,
      errors: genResult.errors.map((e) => ({
        code: "GENERATION_FAILURE",
        message: e.message || String(e)
      })),
      metrics: {
        generation_time_ms: generationTimeMs,
        webhook_time_ms: 0,
        total_time_ms: totalTimeMs
      }
    });

    if (config.webhook) {
      setProgress("Sending Webhook");
      const webhookResult = await sendWebhook(config.webhook, response);
      webhookTimeMs = webhookResult.duration_ms || 0;

      response = createResponse({
        ...response,
        metrics: {
          ...response.metrics,
          webhook_time_ms: webhookTimeMs,
          total_time_ms: Math.round(performance.now() - (session.pipelineStart || genStart))
        },
        webhook_delivered: webhookResult.delivered,
        webhook_attempts: webhookResult.attempts,
        webhook_error: webhookResult.error || undefined,
        warnings: webhookResult.delivered
          ? response.warnings
          : [
              ...(response.warnings || []),
              `Webhook delivery failed after ${webhookResult.attempts} attempts.`
            ]
      });
    }

    setProgress(success ? "Completed" : "Failed");
    if (success) {
      registerJobId(config.job_id);
      saveHistory(response);
    }

    return response;
  } catch (err) {
    const isTimeout = String(err.message).toLowerCase().includes("timed out");
    log("ERROR", `Pipeline failed: ${err.message}`);

    if (session.currentStage) endStage(session.currentStage);

    const totalTimeMs = Math.round(performance.now() - (session.pipelineStart || performance.now()));

    let response = createFailureResponse(
      [{
        code: isTimeout ? "TIMEOUT" : "GENERATION_FAILURE",
        message: err.message
      }],
      { job_id: session.jobId }
    );

    // Attach metrics for debugging even on failure when partial work occurred
    response = {
      ...response,
      metrics: {
        generation_time_ms: session.stageTimings["Generating Image"] || 0,
        webhook_time_ms: webhookTimeMs,
        total_time_ms: totalTimeMs,
        stages: { ...session.stageTimings }
      }
    };

    if (rawConfig.webhook) {
      try {
        setProgress("Sending Webhook");
        const webhookResult = await sendWebhook(rawConfig.webhook, response);
        webhookTimeMs = webhookResult.duration_ms || 0;
        response.metrics.webhook_time_ms = webhookTimeMs;
        response.metrics.total_time_ms = Math.round(performance.now() - (session.pipelineStart || performance.now()));
      } catch (whErr) {
        log("WARNING", "Failed to send error webhook", { error: whErr.message });
      }
    }

    setProgress("Failed");
    return response;
  }
}
