"use strict";

const assert = require("assert");
const {
  buildModelsUrl,
  chooseCompactModel,
  chooseCompactRequestModel,
  extractModelIds,
  stripReasoningSuffix,
} = require("../src/modelResolver");

assert.strictEqual(
  buildModelsUrl("https://newapi.boyweb.net/v1/responses"),
  "https://newapi.boyweb.net/v1/models"
);
assert.strictEqual(
  buildModelsUrl("https://newapi.boyweb.net/v1/responses/compact"),
  "https://newapi.boyweb.net/v1/models"
);

assert.deepStrictEqual(
  extractModelIds({ data: [{ id: "gpt-5.5-openai-compact" }, { id: "gpt-5.5" }] }),
  ["gpt-5.5-openai-compact", "gpt-5.5"]
);

assert.strictEqual(stripReasoningSuffix("gpt-5.5-xhigh"), "gpt-5.5");
assert.strictEqual(stripReasoningSuffix("gpt-5.5-high"), "gpt-5.5");

assert.strictEqual(
  chooseCompactModel("gpt-5.5-xhigh", [
    "gpt-5.4-openai-compact",
    "gpt-5.5-openai-compact",
    "gpt-5.5",
  ]),
  "gpt-5.5-openai-compact"
);

assert.deepStrictEqual(
  chooseCompactRequestModel("gpt-5.5-xhigh", [
    "gpt-5.4-openai-compact",
    "gpt-5.5-openai-compact",
  ]),
  {
    requestModel: "gpt-5.5",
    matchedModel: "gpt-5.5-openai-compact",
    reason: "matched-backend-compact-model",
  }
);

assert.strictEqual(
  chooseCompactModel("gpt-5.4-xhigh", [
    "gpt-5.5-openai-compact",
    "gpt-5.4-openai-compact",
  ]),
  "gpt-5.4-openai-compact"
);

assert.deepStrictEqual(
  chooseCompactRequestModel("gpt-5.4-xhigh", [
    "gpt-5.5-openai-compact",
    "gpt-5.4-openai-compact",
  ]),
  {
    requestModel: "gpt-5.4",
    matchedModel: "gpt-5.4-openai-compact",
    reason: "matched-backend-compact-model",
  }
);

assert.deepStrictEqual(
  chooseCompactRequestModel("claude-sonnet-4.5-high", [
    "claude-sonnet-4.5-openai-compact",
    "gpt-5.5-openai-compact",
  ]),
  {
    requestModel: "claude-sonnet-4.5",
    matchedModel: "claude-sonnet-4.5-openai-compact",
    reason: "matched-backend-compact-model",
  }
);

console.log("modelResolver tests passed");
