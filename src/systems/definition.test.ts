import { test } from "node:test";
import assert from "node:assert/strict";
import { missingRequiredParams } from "./definition.js";
import type { IntentDefinition } from "./definition.js";

const intent: IntentDefinition = {
  name: "create_ticket",
  description: "",
  params: [
    { name: "subject", required: true },
    { name: "priority", required: false },
  ],
  mutating: true,
};

test("missingRequiredParams reports a required param that was not supplied", () => {
  assert.deepEqual(missingRequiredParams(intent, { priority: "High" }), ["subject"]);
});

test("missingRequiredParams passes when every required param is supplied", () => {
  assert.deepEqual(missingRequiredParams(intent, { subject: "x" }), []);
});
