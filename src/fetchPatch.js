"use strict";

const {
  detectCompactRequest,
  isResponsesEndpoint,
  rewriteResponsesUrl,
} = require("./compactDetector");
const {
  buildModelsUrl,
  chooseCompactModel,
  extractModelIds,
} = require("./modelResolver");

const PATCH_SYMBOL = Symbol.for("copilotCompact.fetchPatch");
const modelsCache = new Map();

/**
 * @typedef {Object} PatchConfig
 * @property {boolean} enabled
 * @property {string[]} targetHosts
 * @property {string} compactPathSuffix
 * @property {string} compactModelOverride
 * @property {"compactOnly" | "allResponses"} rewriteMode
 * @property {"off" | "info" | "debug"} logLevel
 */

/**
 * @typedef {Object} PatchOptions
 * @property {{ info: Function, debug: Function, warn?: Function }} logger
 * @property {() => PatchConfig} getConfig
 */

/**
 * @param {PatchOptions} options
 */
function installFetchPatch(options) {
  const g = globalThis;
  if (typeof g.fetch !== "function") {
    options.logger.warn?.("globalThis.fetch is not available; nothing to patch.");
    return;
  }

  const existing = g[PATCH_SYMBOL];
  if (existing?.installed) {
    existing.options = options;
    options.logger.debug("Fetch patch already installed; updated options.");
    return;
  }

  const originalFetch = g.fetch;

  async function patchedFetch(input, init) {
    const state = g[PATCH_SYMBOL];
    const activeOptions = state?.options || options;
    try {
      const rewrite = await prepareRewrite(input, init, activeOptions);
      if (rewrite) {
        const finalRequest = await prepareFinalCompactRequest(rewrite, input, init, originalFetch, activeOptions);
        activeOptions.logger.info("Rewriting compact request", {
          from: redactUrl(rewrite.oldUrl),
          to: redactUrl(rewrite.newUrl),
          model: finalRequest.modelChange || "unchanged",
          score: rewrite.detection.score,
          reasons: rewrite.detection.reasons,
        });
        return originalFetch.call(this, finalRequest.input, finalRequest.init);
      }
    } catch (error) {
      activeOptions.logger.warn?.("Failed to inspect fetch request; sending original request.", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return originalFetch.call(this, input, init);
  }

  Object.defineProperty(patchedFetch, "name", {
    value: "copilotCompactPatchedFetch",
    configurable: true,
  });

  g.fetch = patchedFetch;
  g[PATCH_SYMBOL] = {
    installed: true,
    originalFetch,
    options,
  };
  options.logger.debug("Fetch patch installed.");
}

function uninstallFetchPatch() {
  const g = globalThis;
  const state = g[PATCH_SYMBOL];
  if (!state?.installed) {
    return;
  }
  if (typeof state.originalFetch === "function") {
    g.fetch = state.originalFetch;
  }
  delete g[PATCH_SYMBOL];
}

/**
 * @param {unknown} input
 * @param {RequestInit | undefined} init
 * @param {PatchOptions} options
 * @returns {Promise<null | { oldUrl: string, newUrl: string, bodyText: string, detection: { isCompact: boolean, score: number, reasons: string[] } }>}
 */
async function prepareRewrite(input, init, options) {
  const cfg = options.getConfig();
  if (!cfg.enabled) {
    return null;
  }

  const method = extractMethod(input, init);
  if (method !== "POST") {
    return null;
  }

  const oldUrl = extractUrl(input);
  if (!oldUrl || !isResponsesEndpoint(oldUrl, { targetHosts: cfg.targetHosts })) {
    return null;
  }

  const bodyText = await extractBodyText(input, init);
  if (!bodyText) {
    options.logger.debug("Skipping /responses request with unreadable body.", { url: redactUrl(oldUrl) });
    return null;
  }

  let detection = { isCompact: true, score: 999, reasons: ["allResponses-mode"] };
  if (cfg.rewriteMode !== "allResponses") {
    detection = detectCompactRequest(bodyText);
    if (!detection.isCompact) {
      options.logger.debug("Leaving normal /responses request unchanged.", {
        url: redactUrl(oldUrl),
        score: detection.score,
        reasons: detection.reasons,
      });
      return null;
    }
  }

  const newUrl = rewriteResponsesUrl(oldUrl, { compactPathSuffix: cfg.compactPathSuffix });
  if (newUrl === oldUrl) {
    return null;
  }

  return {
    oldUrl,
    newUrl,
    bodyText,
    detection,
  };
}

/**
 * @param {{ oldUrl: string, newUrl: string, bodyText: string }} rewrite
 * @param {unknown} input
 * @param {RequestInit | undefined} init
 * @param {typeof fetch} originalFetch
 * @param {PatchOptions} options
 * @returns {Promise<{ input: unknown, init: RequestInit | undefined, modelChange: string }>}
 */
async function prepareFinalCompactRequest(rewrite, input, init, originalFetch, options) {
  let bodyText = rewrite.bodyText;
  let modelChange = "";

  try {
    const body = JSON.parse(bodyText);
    const originalModel = typeof body.model === "string" ? body.model : "";
    if (originalModel) {
      const compactModel = await resolveCompactModel(originalModel, rewrite.oldUrl, input, init, originalFetch, options);
      if (compactModel && compactModel !== originalModel) {
        body.model = compactModel;
        bodyText = JSON.stringify(body);
        modelChange = `${originalModel} -> ${compactModel}`;
      }
    }
  } catch (error) {
    options.logger.warn?.("Failed to rewrite compact model; keeping original model.", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    input: rewriteFetchInput(input, rewrite.newUrl),
    init: rewriteFetchInitWithBody(init, bodyText),
    modelChange,
  };
}

/**
 * @param {string} originalModel
 * @param {string} responsesUrl
 * @param {unknown} input
 * @param {RequestInit | undefined} init
 * @param {typeof fetch} originalFetch
 * @param {PatchOptions} options
 * @returns {Promise<string>}
 */
async function resolveCompactModel(originalModel, responsesUrl, input, init, originalFetch, options) {
  const cfg = options.getConfig();
  if (typeof cfg.compactModelOverride === "string" && cfg.compactModelOverride.trim()) {
    return cfg.compactModelOverride.trim();
  }

  const modelsUrl = buildModelsUrl(responsesUrl);
  const modelIds = await fetchModelIds(modelsUrl, input, init, originalFetch, options);
  const compactModel = chooseCompactModel(originalModel, modelIds);
  if (!compactModel) {
    options.logger.warn?.("No matching compact model found; keeping original model.", {
      originalModel,
      modelsUrl: redactUrl(modelsUrl),
      compactCandidates: modelIds.filter((id) => id.toLowerCase().includes("compact")).slice(0, 20),
    });
  }
  return compactModel;
}

/**
 * @param {string} modelsUrl
 * @param {unknown} input
 * @param {RequestInit | undefined} init
 * @param {typeof fetch} originalFetch
 * @param {PatchOptions} options
 * @returns {Promise<string[]>}
 */
async function fetchModelIds(modelsUrl, input, init, originalFetch, options) {
  const headers = extractHeaders(input, init);
  const authKey = headers.get("authorization") || headers.get("x-api-key") || "";
  const cacheKey = `${modelsUrl}|${authKey ? "auth" : "no-auth"}`;
  const cached = modelsCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < 5 * 60 * 1000) {
    return cached.modelIds;
  }

  const modelHeaders = new Headers();
  for (const key of ["authorization", "x-api-key", "api-key", "user-agent"]) {
    const value = headers.get(key);
    if (value) {
      modelHeaders.set(key, value);
    }
  }
  modelHeaders.set("accept", "application/json");

  const response = await originalFetch(modelsUrl, {
    method: "GET",
    headers: modelHeaders,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    options.logger.warn?.("Failed to fetch backend models; keeping original compact model.", {
      modelsUrl: redactUrl(modelsUrl),
      status: response.status,
      body: text.slice(0, 240),
    });
    return [];
  }

  const payload = await response.json();
  const modelIds = extractModelIds(payload);
  modelsCache.set(cacheKey, { ts: Date.now(), modelIds });
  options.logger.debug("Fetched backend models.", {
    modelsUrl: redactUrl(modelsUrl),
    count: modelIds.length,
    compactCandidates: modelIds.filter((id) => id.toLowerCase().includes("compact")).slice(0, 20),
  });
  return modelIds;
}

/**
 * @param {unknown} input
 * @param {RequestInit | undefined} init
 * @returns {string}
 */
function extractMethod(input, init) {
  const initMethod = init?.method;
  if (typeof initMethod === "string" && initMethod.trim()) {
    return initMethod.trim().toUpperCase();
  }
  const request = asRequest(input);
  if (request && typeof request.method === "string") {
    return request.method.trim().toUpperCase();
  }
  return "GET";
}

/**
 * @param {unknown} input
 * @returns {string}
 */
function extractUrl(input) {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  const request = asRequest(input);
  if (request && typeof request.url === "string") {
    return request.url;
  }
  return "";
}

/**
 * @param {unknown} input
 * @param {string} newUrl
 * @returns {unknown}
 */
function rewriteFetchInput(input, newUrl) {
  if (typeof input === "string") {
    return newUrl;
  }
  if (input instanceof URL) {
    return new URL(newUrl);
  }
  const request = asRequest(input);
  if (request && typeof Request === "function") {
    return new Request(newUrl, request);
  }
  return newUrl;
}

/**
 * @param {RequestInit | undefined} init
 * @param {string} bodyText
 * @returns {RequestInit}
 */
function rewriteFetchInitWithBody(init, bodyText) {
  return {
    ...(init || {}),
    body: bodyText,
  };
}

/**
 * @param {unknown} input
 * @param {RequestInit | undefined} init
 * @returns {Headers}
 */
function extractHeaders(input, init) {
  const headers = new Headers();
  const request = asRequest(input);
  if (request?.headers) {
    for (const [key, value] of request.headers.entries()) {
      headers.set(key, value);
    }
  }
  if (init?.headers) {
    const initHeaders = new Headers(init.headers);
    for (const [key, value] of initHeaders.entries()) {
      headers.set(key, value);
    }
  }
  return headers;
}

/**
 * @param {unknown} input
 * @param {RequestInit | undefined} init
 * @returns {Promise<string>}
 */
async function extractBodyText(input, init) {
  if (init && "body" in init && init.body != null) {
    return bodyToText(init.body);
  }
  const request = asRequest(input);
  if (request && typeof request.clone === "function") {
    return request.clone().text();
  }
  return "";
}

/**
 * @param {unknown} body
 * @returns {Promise<string>}
 */
async function bodyToText(body) {
  if (typeof body === "string") {
    return body;
  }
  if (body instanceof Uint8Array) {
    return new TextDecoder().decode(body);
  }
  if (typeof ArrayBuffer !== "undefined" && body instanceof ArrayBuffer) {
    return new TextDecoder().decode(new Uint8Array(body));
  }
  if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) {
    return body.toString();
  }
  if (typeof Blob !== "undefined" && body instanceof Blob) {
    return body.text();
  }
  return "";
}

/**
 * @param {unknown} input
 * @returns {Request | null}
 */
function asRequest(input) {
  if (typeof Request !== "function") {
    return null;
  }
  return input instanceof Request ? input : null;
}

/**
 * @param {string} rawUrl
 * @returns {string}
 */
function redactUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return rawUrl;
  }
}

module.exports = {
  installFetchPatch,
  uninstallFetchPatch,
  prepareRewrite,
  prepareFinalCompactRequest,
};
