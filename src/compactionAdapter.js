"use strict";

const MARKER_PREFIX = "copilot-compact";
const markerStore = new Map();

/**
 * @param {Response} response
 * @param {{ info?: Function, debug?: Function, warn?: Function }} logger
 * @returns {Promise<Response>}
 */
async function adaptCompactResponseForCopilot(response, logger) {
  if (!response || !response.ok) {
    return response;
  }

  const text = await response.clone().text().catch(() => "");
  if (!text || looksLikeSse(text)) {
    return response;
  }

  const payload = safeJsonParse(text);
  const compactionItems = extractCompactionItems(payload);
  if (compactionItems.length === 0) {
    logger.debug?.("Compact response did not contain compaction items; leaving response unchanged.");
    return response;
  }

  const marker = storeCompactionItems(compactionItems);
  const markerText = renderMarkerText(marker, compactionItems.length);
  logger.info?.("Adapted compact response for Copilot summarizer.", {
    marker,
    itemCount: compactionItems.length,
  });

  return new Response(renderSyntheticSse(markerText, payload?.id), {
    status: response.status,
    statusText: response.statusText,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
    },
  });
}

/**
 * @param {string} bodyText
 * @param {{ debug?: Function, warn?: Function }} logger
 * @returns {{ bodyText: string, changed: boolean, replacementCount: number }}
 */
function replaceCompactionMarkersInBody(bodyText, logger) {
  const body = safeJsonParse(bodyText);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { bodyText, changed: false, replacementCount: 0 };
  }

  const input = body.input;
  if (!Array.isArray(input)) {
    return { bodyText, changed: false, replacementCount: 0 };
  }

  let replacementCount = 0;
  const nextInput = [];
  for (const item of input) {
    const markers = findMarkersInValue(item);
    if (markers.length === 0) {
      nextInput.push(item);
      continue;
    }

    let replaced = false;
    for (const marker of unique(markers)) {
      const stored = markerStore.get(marker);
      if (!stored) {
        logger.warn?.("Found compact marker but no stored compaction items are available.", { marker });
        continue;
      }
      nextInput.push(...cloneJson(stored.items));
      replacementCount += stored.items.length;
      replaced = true;
    }

    if (!replaced) {
      nextInput.push(item);
    }
  }

  if (replacementCount === 0) {
    return { bodyText, changed: false, replacementCount: 0 };
  }

  body.input = nextInput;
  logger.debug?.("Replaced compact markers in request input.", { replacementCount });
  return {
    bodyText: JSON.stringify(body),
    changed: true,
    replacementCount,
  };
}

/**
 * @param {unknown} payload
 * @returns {Array<Record<string, unknown>>}
 */
function extractCompactionItems(payload) {
  const out = [];
  visit(payload);
  return out;

  function visit(value) {
    if (!value) {
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item);
      }
      return;
    }
    if (typeof value !== "object") {
      return;
    }
    const obj = /** @type {Record<string, unknown>} */ (value);
    if (isCompactionItem(obj)) {
      out.push(cloneJson(obj));
      return;
    }
    for (const key of ["output", "data", "items", "input"]) {
      if (key in obj) {
        visit(obj[key]);
      }
    }
  }
}

/**
 * @param {Record<string, unknown>} obj
 * @returns {boolean}
 */
function isCompactionItem(obj) {
  return (
    (obj.type === "compaction" || obj.type === "compaction_summary") &&
    typeof obj.encrypted_content === "string" &&
    obj.encrypted_content.length > 0
  );
}

/**
 * @param {Array<Record<string, unknown>>} items
 * @returns {string}
 */
function storeCompactionItems(items) {
  const marker = `${MARKER_PREFIX}-${randomId()}`;
  markerStore.set(marker, {
    createdAt: Date.now(),
    items: cloneJson(items),
  });
  return marker;
}

/**
 * @param {string} marker
 * @param {number} itemCount
 * @returns {string}
 */
function renderMarkerText(marker, itemCount) {
  return `<copilot-compact id="${marker}">Conversation history was compacted into ${itemCount} opaque Responses API compaction item(s). Keep this marker exactly; it will be expanded by the Copilot Compact extension.</copilot-compact>`;
}

/**
 * @param {string} text
 * @param {unknown} responseId
 * @returns {string}
 */
function renderSyntheticSse(text, responseId) {
  const id = typeof responseId === "string" && responseId ? responseId : `resp_${randomId()}`;
  const itemId = `msg_${randomId()}`;
  const events = [
    {
      type: "response.output_text.delta",
      output_index: 0,
      content_index: 0,
      item_id: itemId,
      delta: text,
      sequence_number: 1,
    },
    {
      type: "response.output_text.done",
      output_index: 0,
      content_index: 0,
      item_id: itemId,
      text,
      sequence_number: 2,
    },
    {
      type: "response.completed",
      response: {
        id,
        status: "completed",
      },
      sequence_number: 3,
    },
  ];
  return `${events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("")}data: [DONE]\n\n`;
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function findMarkersInValue(value) {
  const text = [];
  collectText(value, text, 0);
  const markers = [];
  const pattern = /<copilot-compact\s+id=["']([^"']+)["'][^>]*>[\s\S]*?<\/copilot-compact>/gi;
  for (const part of text) {
    let match;
    while ((match = pattern.exec(part))) {
      markers.push(match[1]);
    }
  }
  return markers;
}

/**
 * @param {unknown} value
 * @param {string[]} out
 * @param {number} depth
 */
function collectText(value, out, depth) {
  if (depth > 12 || value == null) {
    return;
  }
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectText(item, out, depth + 1);
    }
    return;
  }
  if (typeof value !== "object") {
    return;
  }
  for (const nested of Object.values(value)) {
    collectText(nested, out, depth + 1);
  }
}

/**
 * @param {string} text
 * @returns {boolean}
 */
function looksLikeSse(text) {
  return /^\s*(event:|data:)/.test(text);
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
 * @template T
 * @param {T} value
 * @returns {T}
 */
function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * @param {string[]} values
 * @returns {string[]}
 */
function unique(values) {
  return Array.from(new Set(values));
}

function randomId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

module.exports = {
  adaptCompactResponseForCopilot,
  extractCompactionItems,
  findMarkersInValue,
  isCompactionItem,
  markerStore,
  replaceCompactionMarkersInBody,
  renderSyntheticSse,
  storeCompactionItems,
};
