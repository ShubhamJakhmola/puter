/** @file Local generation history (localStorage). */

import { DEFAULTS, HISTORY_KEY } from "./config.js";
import { log } from "./logger.js";
import { dom } from "./dom.js";
import { escapeHtml, formatTime } from "./utils.js";

/**
 * Persist a successful generation to localStorage.
 * @param {object} response
 */
export function saveHistory(response) {
  if (!response.success || !response.images?.length) return;

  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const list = raw ? JSON.parse(raw) : [];
    list.unshift({
      request_id: response.request_id,
      prompt: response.prompt,
      image_count: response.image_count,
      thumbnail: response.images[0]?.url || "",
      timestamp: response.timestamp
    });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, DEFAULTS.historyLimit)));
  } catch (err) {
    log("WARNING", "Failed to save history", { error: err.message });
  }
}

/**
 * Render history list in preview mode.
 */
export function renderHistory() {
  if (!dom.historyList) return;

  let list = [];
  try {
    list = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    list = [];
  }

  if (!list.length) {
    dom.historyList.innerHTML = '<p class="sub" style="margin:0;">No history yet.</p>';
    return;
  }

  dom.historyList.innerHTML = "";
  list.forEach((item) => {
    const el = document.createElement("div");
    el.className = "history-item";
    el.innerHTML =
      `<span class="prompt-text">${escapeHtml(item.prompt)}</span>` +
      `<span class="when">${formatTime(item.timestamp)} · ${item.image_count} img</span>`;
    el.addEventListener("click", () => {
      if (dom.manualPrompt) dom.manualPrompt.value = item.prompt;
    });
    dom.historyList.appendChild(el);
  });
}
