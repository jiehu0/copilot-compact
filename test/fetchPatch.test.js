"use strict";

const assert = require("assert");
const {
  cleanCompactRequestBody,
  prepareFinalCompactRequest,
} = require("../src/fetchPatch");

const cleaned = cleanCompactRequestBody({
  model: "gpt-5.5",
  input: [],
  instructions: "summarize",
  stream: true,
  tools: [{ type: "function", name: "x" }],
  tool_choice: "auto",
  prompt_cache_key: "cache",
  previous_response_id: "resp_1",
});

assert.deepStrictEqual(Object.keys(cleaned), ["model", "input", "instructions", "previous_response_id"]);
assert.strictEqual(cleaned.stream, undefined);
assert.strictEqual(cleaned.tools, undefined);

(async () => {
  const body = JSON.stringify({
    model: "gpt-5.5-xhigh",
    input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "Summarize the conversation history so far" }] }],
    instructions: "Your task is to create a comprehensive, detailed summary of the entire conversation",
    stream: true,
    tools: [{ type: "function", name: "x" }],
    tool_choice: "auto",
    prompt_cache_key: "cache",
  });

  const mockFetch = async () => ({
    ok: true,
    json: async () => ({ data: [{ id: "gpt-5.5-openai-compact" }] }),
  });
  const options = {
    getConfig() {
      return {
        enabled: true,
        targetHosts: [],
        compactPathSuffix: "compact",
        compactModelOverride: "",
        responsesCompactModel: "",
        rewriteMode: "compactOnly",
        logLevel: "debug",
      };
    },
    logger: {},
  };
  const result = await prepareFinalCompactRequest(
    { oldUrl: "https://newapi.boyweb.net/v1/responses", newUrl: "https://newapi.boyweb.net/v1/responses/compact", bodyText: body },
    "https://newapi.boyweb.net/v1/responses",
    { method: "POST", headers: { authorization: "Bearer test" }, body },
    mockFetch,
    options
  );
  const parsed = JSON.parse(result.init.body);
  assert.strictEqual(parsed.model, "gpt-5.5");
  assert.strictEqual(parsed.stream, undefined);
  assert.strictEqual(parsed.tools, undefined);
  assert.strictEqual(parsed.tool_choice, undefined);
  assert.strictEqual(parsed.prompt_cache_key, undefined);
  assert.ok(result.modelChange.includes("gpt-5.5-xhigh -> gpt-5.5"));

  console.log("fetchPatch tests passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
