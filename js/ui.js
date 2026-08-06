/** @file UI rendering and global response exposure. */

import { dom } from "./dom.js";
import { escapeHtml } from "./utils.js";

/**
 * Configure headless vs preview UI mode.
 * @param {boolean} preview
 * @param {boolean} autoRun
 */
export function configureUiMode(preview, autoRun) {
  const headless = autoRun && !preview;
  document.body.classList.toggle("headless", headless);

  if (headless) {
    dom.headlessPanel.hidden = false;
    dom.previewPanel.hidden = true;
  } else {
    dom.headlessPanel.hidden = true;
    dom.previewPanel.hidden = false;
  }
}

/**
 * Render preview gallery and metadata.
 * @param {object} response
 */
export function renderPreview(response) {
  dom.resultPanel.hidden = false;
  dom.jsonOutput.hidden = false;

  dom.resultStatus.textContent = response.success ? "Completed" : "Failed";
  dom.resultStatus.className = "status-pill " + (response.success ? "done" : "failed");

  dom.metaGrid.innerHTML = "";
  const metaFields = [
    ["Request ID", response.request_id],
    ["Prompt", response.prompt],
    ["Provider", response.provider],
    ["Model", response.model],
    ["Quality", response.quality],
    ["Test mode", String(response.test_mode)],
    ["Images", String(response.image_count)],
    ["Duration", response.generation_time + " ms"],
    ["Timestamp", response.timestamp]
  ];

  metaFields.forEach(([k, v]) => {
    const item = document.createElement("div");
    item.className = "meta-item";
    item.innerHTML = `<div class="k">${escapeHtml(k)}</div><div class="v">${escapeHtml(String(v))}</div>`;
    dom.metaGrid.appendChild(item);
  });

  dom.errorBox.hidden = true;
  dom.errorBox.innerHTML = "";
  document.getElementById("warn-box")?.remove();

  const allErrors = [...(response.errors || [])];
  if (response.webhook_error) {
    allErrors.push({ message: "Webhook: " + response.webhook_error });
  }
  if (allErrors.length) {
    dom.errorBox.hidden = false;
    dom.errorBox.className = "alert err";
    dom.errorBox.textContent = allErrors
      .map((e) => (typeof e === "string" ? e : e.message))
      .join(" · ");
  }
  if (response.warnings?.length) {
    const warn = document.createElement("div");
    warn.id = "warn-box";
    warn.className = "alert warn";
    warn.textContent = response.warnings.join(" · ");
    dom.errorBox.parentNode.insertBefore(warn, dom.errorBox.nextSibling);
  }

  dom.gallery.innerHTML = "";
  if (response.images?.length) {
    response.images.forEach((img, i) => {
      const card = document.createElement("div");
      card.className = "img-card";

      const el = document.createElement("img");
      el.src = img.url;
      el.alt = `Generated image ${i + 1}`;
      el.loading = "lazy";

      const cap = document.createElement("div");
      cap.className = "cap";
      cap.textContent = `#${i + 1} · ${img.width || "?"}×${img.height || "?"} · ${img.generation_duration_ms}ms`;

      const dl = document.createElement("a");
      dl.href = img.url;
      dl.download = `puter-${response.request_id}-${i + 1}.png`;
      dl.className = "btn btn-ghost";
      dl.style.cssText = "display:block;margin:8px;text-align:center;text-decoration:none;font-size:11px;";
      dl.textContent = "Download";

      card.append(el, cap, dl);
      dom.gallery.appendChild(card);
    });
  } else if (!response.success) {
    dom.gallery.innerHTML = '<div class="placeholder">Generation failed — see errors above.</div>';
  } else {
    dom.gallery.innerHTML = '<div class="placeholder">No images returned.</div>';
  }

  dom.jsonOutput.textContent = JSON.stringify(response, null, 2);
}

/**
 * Render a fatal error in the UI.
 * @param {object} response
 */
export function renderError(response) {
  renderPreview(response);
}

/**
 * Expose JSON globally for Make.com HTTP module scraping.
 * @param {object} response
 */
export function exposeGlobalResponse(response) {
  window.__PUTER_BRIDGE_RESPONSE__ = response;
  window.__PUTER_BRIDGE_JSON__ = JSON.stringify(response);

  let node = document.getElementById("bridge-json-output");
  if (!node) {
    node = document.createElement("script");
    node.id = "bridge-json-output";
    node.type = "application/json";
    document.body.appendChild(node);
  }
  node.textContent = JSON.stringify(response);
}

/**
 * Apply final response to UI and globals.
 * @param {object} response
 * @param {boolean} preview
 * @param {Function} renderHistoryFn
 */
export function finalize(response, preview, renderHistoryFn) {
  if (preview) {
    if (response.success) renderPreview(response);
    else renderError(response);
    renderHistoryFn();
  } else {
    dom.headlessPanel.hidden = false;
    dom.headlessStatus.textContent = response.success ? "Completed" : "Failed";
    if (!response.success) {
      dom.resultPanel.hidden = false;
      renderError(response);
    }
  }
}
