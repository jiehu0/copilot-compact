"use strict";

const assert = require("assert");
const {
  adaptCompactResponseForCopilot,
  extractCompactionItems,
  markerStore,
  replaceCompactionMarkersInBody,
  storeCompactionItems,
} = require("../src/compactionAdapter");

const payload = {
  id: "resp_1",
  output: [
    {
      type: "compaction_summary",
      id: "cmp_1",
      encrypted_content: "encrypted",
    },
  ],
};

const items = extractCompactionItems(payload);
assert.strictEqual(items.length, 1);
assert.strictEqual(items[0].type, "compaction_summary");

const marker = storeCompactionItems(items);
assert.ok(markerStore.has(marker));

const body = JSON.stringify({
  model: "gpt-5.5",
  input: [
    {
      type: "message",
      role: "user",
      content: [{ type: "input_text", text: `<copilot-compact id="${marker}">x</copilot-compact>` }],
    },
    {
      type: "message",
      role: "user",
      content: [{ type: "input_text", text: "next" }],
    },
  ],
});
const replaced = replaceCompactionMarkersInBody(body, {});
assert.strictEqual(replaced.changed, true);
const parsed = JSON.parse(replaced.bodyText);
assert.strictEqual(parsed.input[0].type, "compaction_summary");
assert.strictEqual(parsed.input[0].encrypted_content, "encrypted");
assert.strictEqual(parsed.input[1].type, "message");

(async () => {
  const response = new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
  const adapted = await adaptCompactResponseForCopilot(response, {});
  assert.strictEqual(adapted.headers.get("content-type").startsWith("text/event-stream"), true);
  const text = await adapted.text();
  assert.ok(text.includes("response.output_text.delta"));
  assert.ok(text.includes("copilot-compact"));
  console.log("compactionAdapter tests passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
