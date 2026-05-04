"use strict";

const DEFAULT_COMPACT_SUFFIX = "compact";

/**
 * @typedef {Object} CompactDetection
 * @property {boolean} isCompact
 * @property {number} score
 * @property {string[]} reasons
 */

/**
 * @param {unknown} value
 * @returns {CompactDetection}
 */
function detectCompactRequest(value) {
  const body = typeof value === "string" ? safeJsonParse(value) : value;
  const reasons = [];
  let score = 0;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { isCompact: false, score, reasons };
  }

  const request = /** @type {Record<string, unknown>} */ (body);
  const instructions = normalizeText(request.instructions);
  const inputText = collectInputText(request.input).join("\n");
  const allText = `${instructions}\n${inputText}`.toLowerCase();

  if (Array.isArray(request.input)) {
    score += 1;
    reasons.push("responses-input-array");
  }

  if (request.stream === true) {
    score += 1;
    reasons.push("streaming");
  }

  if (!Array.isArray(request.tools) || request.tools.length === 0) {
    score += 1;
    reasons.push("no-tools");
  }

  if (instructions) {
    const lower = instructions.toLowerCase();
    if (
      lower.includes("create a comprehensive, detailed summary") ||
      lower.includes("comprehensive, detailed summary of the entire conversation")
    ) {
      score += 6;
      reasons.push("copilot-summary-instructions");
    } else if (
      lower.includes("summary") &&
      lower.includes("conversation") &&
      (lower.includes("seamlessly continue") || lower.includes("entire conversation"))
    ) {
      score += 4;
      reasons.push("summary-instructions");
    }
  }

  if (allText.includes("summarize the conversation history so far")) {
    score += 6;
    reasons.push("copilot-summary-user-prompt");
  } else if (
    allText.includes("conversation history") &&
    (allText.includes("summarize") || allText.includes("summary"))
  ) {
    score += 4;
    reasons.push("conversation-history-summary");
  }

  if (
    allText.includes("preserve all essential information") ||
    allText.includes("captures all essential information") ||
    allText.includes("needed to seamlessly continue")
  ) {
    score += 2;
    reasons.push("continuation-summary-language");
  }

  return {
    isCompact: score >= 7 && reasons.some((r) => r.includes("summary") || r.includes("conversation-history")),
    score,
    reasons,
  };
}

/**
 * @param {unknown} input
 * @returns {string[]}
 */
function collectInputText(input) {
  const out = [];
  visit(input, out, 0);
  return out;
}

/**
 * @param {unknown} value
 * @param {string[]} out
 * @param {number} depth
 */
function visit(value, out, depth) {
  if (depth > 12 || value == null) {
    return;
  }
  if (typeof value === "string") {
    if (value.trim()) {
      out.push(value);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      visit(item, out, depth + 1);
    }
    return;
  }
  if (typeof value !== "object") {
    return;
  }
  const obj = /** @type {Record<string, unknown>} */ (value);
  for (const key of ["text", "content", "summary", "value"]) {
    if (key in obj) {
      visit(obj[key], out, depth + 1);
    }
  }
}

/**
 * @param {string} rawUrl
 * @param {{ targetHosts?: string[] }} [options]
 * @returns {boolean}
 */
function isResponsesEndpoint(rawUrl, options = {}) {
  const parsed = toUrl(rawUrl);
  if (!parsed) {
    return false;
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return false;
  }
  const allow = normalizeHostAllowList(options.targetHosts);
  if (allow.length > 0 && !allow.includes(parsed.host.toLowerCase()) && !allow.includes(parsed.hostname.toLowerCase())) {
    return false;
  }
  const path = parsed.pathname.replace(/\/+$/, "");
  return path.endsWith("/responses") && !path.endsWith("/responses/compact");
}

/**
 * @param {string} rawUrl
 * @param {{ compactPathSuffix?: string }} [options]
 * @returns {string}
 */
function rewriteResponsesUrl(rawUrl, options = {}) {
  const parsed = toUrl(rawUrl);
  if (!parsed) {
    return rawUrl;
  }
  const suffix = sanitizePathSegment(options.compactPathSuffix || DEFAULT_COMPACT_SUFFIX);
  const trimmed = parsed.pathname.replace(/\/+$/, "");
  if (!trimmed.endsWith("/responses") || trimmed.endsWith(`/responses/${suffix}`)) {
    return rawUrl;
  }
  parsed.pathname = `${trimmed}/${suffix}`;
  return parsed.toString();
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * @param {string} text
 * @returns {unknown}
 */
function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * @param {string} rawUrl
 * @returns {URL | null}
 */
function toUrl(rawUrl) {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

/**
 * @param {unknown} hosts
 * @returns {string[]}
 */
function normalizeHostAllowList(hosts) {
  if (!Array.isArray(hosts)) {
    return [];
  }
  return hosts
    .filter((item) => typeof item === "string")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * @param {string} segment
 * @returns {string}
 */
function sanitizePathSegment(segment) {
  const trimmed = segment.trim().replace(/^\/+|\/+$/g, "");
  return trimmed || DEFAULT_COMPACT_SUFFIX;
}

module.exports = {
  collectInputText,
  detectCompactRequest,
  isResponsesEndpoint,
  rewriteResponsesUrl,
};
