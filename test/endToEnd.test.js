"use strict";

const assert = require("assert");
const {
  installFetchPatch,
  uninstallFetchPatch,
} = require("../src/fetchPatch");
const { markerStore } = require("../src/compactionAdapter");

function config() {
  return {
    enabled: true,
    targetHosts: [],
    compactPathSuffix: "compact",
    compactModelOverride: "",
    responsesCompactModel: "",
    rewriteMode: "compactOnly",
    logLevel: "debug",
  };
}

function createCompactBody() {
  return JSON.stringify({
    model: "gpt-5.5-xhigh",
    input: [
      {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: "Summarize the conversation history so far so the next assistant can continue seamlessly.",
          },
        ],
      },
    ],
    instructions: "Your task is to create a comprehensive, detailed summary of the entire conversation.",
    stream: true,
    prompt_cache_key: "cache-key-that-compact-should-drop",
  });
}

(async () => {
  markerStore.clear();
  const originalGlobalFetch = globalThis.fetch;
  const calls = [];

  globalThis.fetch = async (url, init = {}) => {
    const href = typeof url === "string" ? url : url.url;
    calls.push({ url: href, init });

    if (href === "https://newapi.boyweb.net/v1/models") {
      return new Response(JSON.stringify({
        data: [
          { id: "gpt-5.4-openai-compact" },
          { id: "gpt-5.5-openai-compact" },
        ],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }

    if (href === "https://newapi.boyweb.net/v1/responses/compact") {
      const body = JSON.parse(init.body);
      assert.strictEqual(body.model, "gpt-5.5");
      assert.strictEqual(body.stream, undefined);
      assert.strictEqual(body.prompt_cache_key, undefined);
      assert.strictEqual(body.tools, undefined);
      return new Response(JSON.stringify({
        id: "resp_compact_1",
        object: "response.compaction",
        output: [
          {
            type: "compaction_summary",
            id: "cmp_1",
            encrypted_content: "encrypted-history",
          },
        ],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }

    if (href === "https://newapi.boyweb.net/v1/responses") {
      const body = JSON.parse(init.body);
      assert.strictEqual(body.input[0].type, "compaction_summary");
      assert.strictEqual(body.input[0].encrypted_content, "encrypted-history");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    throw new Error(`Unexpected fetch URL: ${href}`);
  };

  const logs = [];
  installFetchPatch({
    getConfig: config,
    logger: {
      info: (message, payload) => logs.push(["info", message, payload]),
      debug: (message, payload) => logs.push(["debug", message, payload]),
      warn: (message, payload) => logs.push(["warn", message, payload]),
    },
  });

  try {
    const compactResponse = await fetch("https://newapi.boyweb.net/v1/responses", {
      method: "POST",
      headers: {
        authorization: "Bearer test",
        "content-type": "application/json",
        "x-request-initiator": "github.copilot-chat",
      },
      body: createCompactBody(),
    });

    assert.strictEqual(compactResponse.headers.get("content-type").startsWith("text/event-stream"), true);
    const compactText = await compactResponse.text();
    const deltaLine = compactText
      .split("\n")
      .find((line) => line.startsWith("data: ") && line.includes("response.output_text.delta"));
    const deltaEvent = JSON.parse(deltaLine.slice("data: ".length));
    const marker = deltaEvent.delta.match(/<copilot-compact\s+id="([^"]+)"/)?.[1];
    assert.ok(marker, "compact response should contain a marker");
    assert.ok(markerStore.has(marker), "marker should be stored for later expansion");

    await fetch("https://newapi.boyweb.net/v1/responses", {
      method: "POST",
      headers: {
        authorization: "Bearer test",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.5-xhigh",
        input: [
          {
            type: "message",
            role: "assistant",
            content: [{ type: "output_text", text: `<copilot-compact id="${marker}">stored</copilot-compact>` }],
          },
          {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: "Continue the work." }],
          },
        ],
        tools: [{ type: "function", name: "read_file" }],
      }),
    });

    assert.deepStrictEqual(calls.map((call) => call.url), [
      "https://newapi.boyweb.net/v1/models",
      "https://newapi.boyweb.net/v1/responses/compact",
      "https://newapi.boyweb.net/v1/responses",
    ]);
    assert.ok(logs.some((entry) => entry[1] === "Rewriting compact request"));
    assert.ok(logs.some((entry) => entry[1] === "Adapted compact response for Copilot summarizer."));
    assert.ok(logs.some((entry) => entry[1] === "Expanding stored compact marker(s) in request."));

    console.log("endToEnd tests passed");
  } finally {
    uninstallFetchPatch();
    globalThis.fetch = originalGlobalFetch;
    markerStore.clear();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
