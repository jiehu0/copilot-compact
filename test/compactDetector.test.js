"use strict";

const assert = require("assert");
const {
  detectCompactRequest,
  isResponsesEndpoint,
  rewriteResponsesUrl,
} = require("../src/compactDetector");

const compactBody = {
  model: "gpt-5.5-xhigh",
  input: [
    {
      role: "user",
      type: "message",
      content: [{ type: "input_text", text: "<context>..." }],
      status: "completed",
    },
    {
      role: "user",
      type: "message",
      content: [
        {
          type: "input_text",
          text: "Summarize the conversation history so far, paying attention to important code and decisions.",
        },
      ],
      status: "incomplete",
    },
  ],
  stream: true,
  instructions:
    "Your task is to create a comprehensive, detailed summary of the entire conversation that captures all essential information needed to seamlessly continue the work.",
  temperature: 0.4,
  max_output_tokens: 8192,
};

const normalBody = {
  model: "gpt-5.5-xhigh",
  input: [
    {
      role: "user",
      type: "message",
      content: [{ type: "input_text", text: "请帮我写一个 VSCode 扩展。" }],
      status: "incomplete",
    },
  ],
  stream: true,
  instructions: "You are an expert AI programming assistant.",
  tools: [{ type: "function", name: "read_file" }],
};

const normalBodyWithHistoricalCompactPrompt = {
  model: "gpt-5.5-xhigh",
  input: [
    {
      role: "user",
      type: "message",
      content: [
        {
          type: "input_text",
          text: "Summarize the conversation history so far, paying attention to important code and decisions.",
        },
      ],
      status: "completed",
    },
    {
      role: "user",
      type: "message",
      content: [{ type: "input_text", text: "现在继续帮我写代码。" }],
      status: "incomplete",
    },
  ],
  stream: true,
  instructions: "You are an expert AI programming assistant.",
  tools: [{ type: "function", name: "read_file" }],
};

assert.strictEqual(isResponsesEndpoint("https://newapi.boyweb.net/v1/responses"), true);
assert.strictEqual(isResponsesEndpoint("https://newapi.boyweb.net/v1/responses/compact"), false);
assert.strictEqual(
  isResponsesEndpoint("https://newapi.boyweb.net/v1/responses", { targetHosts: ["openai.boyweb.net"] }),
  false
);
assert.strictEqual(
  rewriteResponsesUrl("https://newapi.boyweb.net/v1/responses?foo=bar"),
  "https://newapi.boyweb.net/v1/responses/compact?foo=bar"
);

const compact = detectCompactRequest(JSON.stringify(compactBody));
assert.strictEqual(compact.isCompact, true, JSON.stringify(compact));
assert.ok(compact.reasons.includes("copilot-summary-instructions"));
assert.ok(compact.reasons.includes("copilot-summary-user-prompt"));

const normal = detectCompactRequest(JSON.stringify(normalBody));
assert.strictEqual(normal.isCompact, false, JSON.stringify(normal));

const normalWithHistoricalCompactPrompt = detectCompactRequest(JSON.stringify(normalBodyWithHistoricalCompactPrompt));
assert.strictEqual(
  normalWithHistoricalCompactPrompt.isCompact,
  false,
  JSON.stringify(normalWithHistoricalCompactPrompt)
);

console.log("compactDetector tests passed");
