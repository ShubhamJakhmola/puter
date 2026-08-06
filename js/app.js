/**
 * @file Puter Image Automation Bridge — application entry point.
 * @version 2.0.0
 */

import { DEFAULTS } from "./config.js";
import { session } from "./session.js";
import { initDom, dom } from "./dom.js";
import { log, setProgress } from "./logger.js";
import { parseParameters } from "./params.js";
import { createResponse } from "./response.js";
import { parseIntBounded } from "./utils.js";
import { runPipeline } from "./pipeline.js";
import { renderHistory } from "./history.js";
import {
  configureUiMode,
  exposeGlobalResponse,
  finalize as finalizeUi
} from "./ui.js";

/**
 * Apply final response to UI, globals, and session.
 * @param {object} response
 * @param {boolean} preview
 */
function finalize(response, preview) {
  session.response = response;
  exposeGlobalResponse(response);
  finalizeUi(response, preview, renderHistory);
}

/**
 * Wire manual UI event listeners.
 */
function bindEvents() {
  dom.copyJson?.addEventListener("click", async () => {
    if (!session.response) return;
    const text = JSON.stringify(session.response, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      dom.copyJson.textContent = "Copied!";
      setTimeout(() => { dom.copyJson.textContent = "Copy JSON"; }, 2000);
    } catch {
      log("WARNING", "Clipboard write failed");
    }
  });

  dom.manualGenerate?.addEventListener("click", async () => {
    const config = {
      prompt: dom.manualPrompt.value,
      model: dom.manualModel.value,
      quality: dom.manualQuality.value,
      provider: DEFAULTS.provider,
      test_mode: dom.manualTest.value === "true",
      count: parseIntBounded(dom.manualCount.value, 1, 1, DEFAULTS.maxCount),
      webhook: "",
      preview: true,
      timeout: DEFAULTS.timeout
    };

    dom.manualGenerate.disabled = true;
    dom.manualStatus.textContent = "Running…";
    dom.manualStatus.className = "status-pill active";

    try {
      const response = await runPipeline(config);
      finalize(response, true);
      dom.manualStatus.textContent = response.success ? "Done" : "Failed";
      dom.manualStatus.className = "status-pill " + (response.success ? "done" : "failed");
    } catch (err) {
      log("ERROR", "Manual run failed", { error: err.message });
      dom.manualStatus.textContent = "Failed";
      dom.manualStatus.className = "status-pill failed";
    } finally {
      dom.manualGenerate.disabled = false;
    }
  });
}

/**
 * Bootstrap on page load.
 */
async function bootstrap() {
  initDom();
  bindEvents();

  setProgress("Initializing");
  const params = parseParameters();
  configureUiMode(params.preview, params.autoRun);
  renderHistory();

  if (params.autoRun) {
    log("INFO", "Auto-run triggered from URL parameters");
    try {
      finalize(await runPipeline(params), params.preview);
    } catch (err) {
      finalize(
        createResponse({
          success: false,
          errors: [{ code: "BOOTSTRAP", message: err.message }]
        }),
        params.preview
      );
    }
  } else {
    setProgress("Completed");
    log("INFO", "Manual mode — waiting for user input");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
