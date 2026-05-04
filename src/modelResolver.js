"use strict";

const REASONING_SUFFIXES = ["xhigh", "high", "medium", "low", "minimal", "thinking", "reasoning"];

/**
 * @param {string} responsesUrl
 * @returns {string}
 */
function buildModelsUrl(responsesUrl) {
  const url = new URL(responsesUrl);
  url.pathname = url.pathname.replace(/\/responses(?:\/compact)?\/?$/, "/models");
  url.search = "";
  url.hash = "";
  return url.toString();
}

/**
 * @param {unknown} payload
 * @returns {string[]}
 */
function extractModelIds(payload) {
  const source = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray(payload.data)
      ? payload.data
      : [];
  return source
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }
      if (item && typeof item === "object" && typeof item.id === "string") {
        return item.id;
      }
      return "";
    })
    .map((id) => id.trim())
    .filter(Boolean);
}

/**
 * Pick the best backend compact deployment for an original model.
 *
 * Example:
 * - original: gpt-5.5-xhigh
 * - backend models: gpt-5.5-openai-compact, gpt-5.4-openai-compact
 * - result: gpt-5.5-openai-compact
 *
 * @param {string} originalModel
 * @param {string[]} modelIds
 * @returns {string}
 */
function chooseCompactModel(originalModel, modelIds) {
  const original = normalize(originalModel);
  const base = stripReasoningSuffix(original);
  const candidates = modelIds.filter((id) => normalize(id).includes("compact"));

  let best = "";
  let bestScore = -Infinity;
  for (const candidate of candidates) {
    const normalized = normalize(candidate);
    const compactBase = stripCompactDecorations(normalized);
    let score = 0;

    if (normalized === `${base}-openai-compact`) {
      score += 1000;
    }
    if (normalized === `${original}-openai-compact`) {
      score += 900;
    }
    if (normalized.includes(base)) {
      score += 300 + base.length;
    }
    if (normalized.includes(original)) {
      score += 200 + original.length;
    }
    if (compactBase === base) {
      score += 180;
    }
    if (compactBase === original) {
      score += 120;
    }
    if (normalized.includes("openai-compact")) {
      score += 30;
    }
    if (normalized.endsWith("compact")) {
      score += 10;
    }

    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return bestScore > 0 ? best : "";
}

/**
 * Choose the model name that should be sent to /responses/compact.
 *
 * new-api compact channels append their own "-openai-compact" suffix internally,
 * so if /models contains "gpt-5.5-openai-compact", the request body should use
 * "gpt-5.5" rather than "gpt-5.5-openai-compact".
 *
 * @param {string} originalModel
 * @param {string[]} modelIds
 * @returns {{ requestModel: string, matchedModel: string, reason: string }}
 */
function chooseCompactRequestModel(originalModel, modelIds) {
  const matchedModel = chooseCompactModel(originalModel, modelIds);
  if (matchedModel) {
    return {
      requestModel: stripCompactDecorations(normalize(matchedModel)),
      matchedModel,
      reason: "matched-backend-compact-model",
    };
  }
  return {
    requestModel: stripReasoningSuffix(normalize(originalModel)),
    matchedModel: "",
    reason: "fallback-strip-reasoning-suffix",
  };
}

/**
 * @param {string} model
 * @returns {string}
 */
function stripReasoningSuffix(model) {
  for (const suffix of REASONING_SUFFIXES) {
    const tail = `-${suffix}`;
    if (model.endsWith(tail)) {
      return model.slice(0, -tail.length);
    }
  }
  return model;
}

/**
 * @param {string} model
 * @returns {string}
 */
function stripCompactDecorations(model) {
  return model
    .replace(/-openai-compact$/, "")
    .replace(/-compact$/, "");
}

/**
 * @param {string} value
 * @returns {string}
 */
function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

module.exports = {
  buildModelsUrl,
  chooseCompactModel,
  chooseCompactRequestModel,
  extractModelIds,
  stripCompactDecorations,
  stripReasoningSuffix,
};
