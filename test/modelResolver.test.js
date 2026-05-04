"use strict";

const assert = require("assert");
const {
  buildModelsUrl,
  chooseCompactModel,
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

assert.strictEqual(
  chooseCompactModel("gpt-5.4-xhigh", [
    "gpt-5.5-openai-compact",
    "gpt-5.4-openai-compact",
  ]),
  "gpt-5.4-openai-compact"
);

console.log("modelResolver tests passed");
