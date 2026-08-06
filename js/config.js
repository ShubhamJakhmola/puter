/** @file Application constants and defaults. */

export const PROVIDER_MODELS = {
  "openai-image-generation": ["gpt-image-1-mini", "gpt-image-1", "gpt-image-1.5", "gpt-image-2"],
  gemini: ["gemini-3-pro-image-preview", "gemini-3.1-flash-image-preview"],
  xai: ["grok-imagine-image", "grok-imagine-image-quality"],
  together: [],
  "replicate-image-generation": []
};

export const VALID_PROVIDERS = Object.keys(PROVIDER_MODELS);
export const OPENAI_QUALITIES = ["low", "medium", "high", "auto"];

export const PROGRESS_STATES = [
  "Initializing",
  "Reading parameters",
  "Authenticating",
  "Generating",
  "Uploading",
  "Webhook",
  "Completed",
  "Failed"
];

export const DEFAULTS = {
  model: "gpt-image-1-mini",
  quality: "low",
  provider: "openai-image-generation",
  test_mode: false,
  count: 1,
  preview: true,
  timeout: 120000,
  maxPromptLength: 4000,
  maxCount: 10,
  historyLimit: 20,
  maxRetries: 3,
  webhookRetries: 3
};

export const HISTORY_KEY = "puter_bridge_history_v1";
export const BRIDGE_VERSION = "2.0.0";
