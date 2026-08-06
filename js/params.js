/** @file URL parameter parsing and validation. */

import {
  DEFAULTS,
  PROVIDER_MODELS,
  VALID_PROVIDERS,
  OPENAI_QUALITIES
} from "./config.js";
import { parseBool, parseIntBounded } from "./utils.js";

/**
 * Read and normalize URL / query parameters.
 * @returns {object}
 */
export function parseParameters() {
  const params = new URLSearchParams(window.location.search);

  const prompt = params.get("prompt") ?? params.get("q") ?? "";
  const webhook = params.get("webhook") ?? params.get("callback") ?? "";
  const provider = (params.get("provider") || DEFAULTS.provider).trim();
  const model = (params.get("model") || DEFAULTS.model).trim();
  const quality = (params.get("quality") || DEFAULTS.quality).trim().toLowerCase();
  const test_mode = parseBool(params.get("test_mode") ?? params.get("test"), DEFAULTS.test_mode);
  const count = parseIntBounded(params.get("count"), DEFAULTS.count, 1, DEFAULTS.maxCount);
  const preview = parseBool(params.get("preview"), DEFAULTS.preview);
  const timeout = parseIntBounded(params.get("timeout"), DEFAULTS.timeout, 5000, 600000);
  const autoRun = Boolean(prompt.trim());

  return {
    prompt,
    model,
    quality,
    provider,
    test_mode,
    webhook: webhook.trim(),
    callback: webhook.trim(),
    count,
    preview,
    timeout,
    autoRun
  };
}

/**
 * Sanitize and validate a prompt string.
 * @param {string} raw
 * @returns {{ valid: boolean, prompt: string, error?: string }}
 */
export function sanitizePrompt(raw) {
  if (typeof raw !== "string") {
    return { valid: false, prompt: "", error: "Prompt must be a string." };
  }

  const prompt = raw
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!prompt) {
    return { valid: false, prompt: "", error: "Prompt is empty after sanitization." };
  }
  if (prompt.length > DEFAULTS.maxPromptLength) {
    return {
      valid: false,
      prompt: "",
      error: `Prompt exceeds maximum length of ${DEFAULTS.maxPromptLength} characters.`
    };
  }
  return { valid: true, prompt };
}

/**
 * Validate provider, model, and quality selections.
 * @param {object} config
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateConfig(config) {
  const errors = [];
  const warnings = [];

  if (!VALID_PROVIDERS.includes(config.provider)) {
    errors.push(`Invalid provider "${config.provider}". Valid: ${VALID_PROVIDERS.join(", ")}.`);
  }

  const allowedModels = PROVIDER_MODELS[config.provider] || [];
  if (allowedModels.length && !allowedModels.includes(config.model)) {
    errors.push(
      `Invalid model "${config.model}" for provider "${config.provider}". Valid: ${allowedModels.join(", ")}.`
    );
  }

  if (config.provider === "openai-image-generation" && !OPENAI_QUALITIES.includes(config.quality)) {
    errors.push(`Invalid quality "${config.quality}". Valid: ${OPENAI_QUALITIES.join(", ")}.`);
  }

  if (config.webhook) {
    try {
      const url = new URL(config.webhook);
      if (!["http:", "https:"].includes(url.protocol)) {
        errors.push("Webhook URL must use http or https.");
      }
    } catch {
      errors.push("Webhook URL is malformed.");
    }
  }

  if (config.count > 1 && config.test_mode) {
    warnings.push("test_mode returns the same sample image for each count.");
  }

  return { valid: errors.length === 0, errors, warnings };
}
