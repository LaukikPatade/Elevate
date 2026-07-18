import { test } from "node:test";
import assert from "node:assert/strict";
import { planConfirmation } from "./confirmation.js";
import type { Step } from "../types.js";
import type { IntentDefinition } from "../systems/definition.js";

const steps: Step[] = [
  { action: "type", value: "{subject}" },
  { action: "click", commit: true },
];

const mutating: IntentDefinition = {
  name: "create_ticket",
  description: "",
  params: [{ name: "subject", required: true }],
  mutating: true,
};

const readOnly: IntentDefinition = { name: "list_tickets", description: "", params: [], mutating: false };

test("an unconfirmed mutating intent requires confirmation and stops before the commit step", () => {
  const plan = planConfirmation(steps, mutating, { subject: "x" }, false);
  assert.ok(plan.requiresConfirmation);
  assert.equal(plan.stopBefore, 1);
});

test("a confirmed mutating intent does not require confirmation", () => {
  assert.equal(planConfirmation(steps, mutating, { subject: "x" }, true).requiresConfirmation, false);
});

test("a non-mutating intent never requires confirmation", () => {
  assert.equal(planConfirmation(steps, readOnly, {}, false).requiresConfirmation, false);
});
