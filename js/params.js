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
  const job_id = (params.get("job_id") ?? params.get("job") ?? "").trim();
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
    job_id,
    count,
    preview,
    timeout,
    autoRun
  };
}

/**
 * Sanitize a prompt string.
 * @param {string} raw
 * @returns {{ valid: boolean, prompt: string, error?: { code: string, message: string } }}
 */
export function sanitizePrompt(raw) {
  if (typeof raw !== "string") {
    return {
      valid: false,
      prompt: "",
      error: { code: "INVALID_PROMPT", message: "Prompt must be a string." }
    };
  }

  const prompt = raw
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!prompt) {
    return {
      valid: false,
      prompt: "",
      error: { code: "EMPTY_PROMPT", message: "Prompt is required and cannot be empty." }
    };
  }

  if (prompt.length < DEFAULTS.minPromptLength) {
    return {
      valid: false,
      prompt: "",
      error: {
        code: "PROMPT_TOO_SHORT",
        message: `Prompt must be at least ${DEFAULTS.minPromptLength} characters (received ${prompt.length}).`
      }
    };
  }

  if (prompt.length > DEFAULTS.maxPromptLength) {
    return {
      valid: false,
      prompt: "",
      error: {
        code: "PROMPT_TOO_LONG",
        message: `Prompt exceeds maximum length of ${DEFAULTS.maxPromptLength} characters.`
      }
    };
  }

  return { valid: true, prompt };
}

/**
 * Validate count parameter.
 * @param {number} count
 * @param {string|number|null|undefined} raw
 * @returns {{ valid: boolean, error?: { code: string, message: string } }}
 */
export function validateCount(count, raw) {
  if (raw !== null && raw !== undefined && raw !== "" && Number.isNaN(parseInt(String(raw), 10))) {
    return {
      valid: false,
      error: { code: "INVALID_COUNT", message: "Count must be a valid integer." }
    };
  }

  if (!Number.isInteger(count) || count < 1 || count > DEFAULTS.maxCount) {
    return {
      valid: false,
      error: {
        code: "INVALID_COUNT",
        message: `Count must be between 1 and ${DEFAULTS.maxCount}.`
      }
    };
  }

  return { valid: true };
}

/**
 * Validate provider, model, quality, count, and webhook.
 * @param {object} config
 * @returns {{ valid: boolean, errors: Array<{ code: string, message: string }>, warnings: string[] }}
 */
export function validateConfig(config) {
  /** @type {Array<{ code: string, message: string }>} */
  const errors = [];
  const warnings = [];

  const countCheck = validateCount(config.count, config.rawCount);
  if (!countCheck.valid) {
    errors.push(countCheck.error);
  }

  if (!VALID_PROVIDERS.includes(config.provider)) {
    errors.push({
      code: "INVALID_PROVIDER",
      message: `Invalid provider "${config.provider}". Valid: ${VALID_PROVIDERS.join(", ")}.`
    });
  }

  const allowedModels = PROVIDER_MODELS[config.provider] || [];
  if (allowedModels.length && !allowedModels.includes(config.model)) {
    errors.push({
      code: "INVALID_MODEL",
      message: `Invalid model "${config.model}" for provider "${config.provider}". Valid: ${allowedModels.join(", ")}.`
    });
  }

  if (config.provider === "openai-image-generation" && !OPENAI_QUALITIES.includes(config.quality)) {
    errors.push({
      code: "INVALID_QUALITY",
      message: `Invalid quality "${config.quality}". Valid: ${OPENAI_QUALITIES.join(", ")}.`
    });
  }

  if (config.webhook) {
    try {
      const url = new URL(config.webhook);
      if (!["http:", "https:"].includes(url.protocol)) {
        errors.push({
          code: "INVALID_WEBHOOK",
          message: "Webhook URL must use http or https."
        });
      }
    } catch {
      errors.push({
        code: "INVALID_WEBHOOK",
        message: "Webhook URL is malformed."
      });
    }
  }

  if (config.count > 1 && config.test_mode) {
    warnings.push("test_mode returns the same sample image for each count.");
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Run full request validation (prompt + config).
 * @param {object} config
 * @returns {{ valid: boolean, config: object, errors: Array<{ code: string, message: string }>, warnings: string[] }}
 */
export function validateRequest(config) {
  const sanitized = sanitizePrompt(config.prompt);
  if (!sanitized.valid) {
    return {
      valid: false,
      config,
      errors: [sanitized.error],
      warnings: []
    };
  }

  const merged = { ...config, prompt: sanitized.prompt };
  const validation = validateConfig(merged);

  return {
    valid: validation.valid,
    config: merged,
    errors: validation.errors,
    warnings: validation.warnings
  };
}
