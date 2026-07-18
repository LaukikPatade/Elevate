import { test } from "node:test";
import assert from "node:assert/strict";
import { HeuristicPlanner } from "./heuristic.js";
import { internalCrm } from "../systems/internal-crm.js";
import type { Intent, PageSnapshot } from "../types.js";

const snapshot: PageSnapshot = {
  url: "http://localhost:4599/",
  title: "Internal CRM",
  nodes: [],
  fingerprint: "fp-test",
  approxTokens: 400,
};

const planner = new HeuristicPlanner();
const plan = (name: string, params: Intent["params"] = {}) =>
  planner.plan({ name, params }, internalCrm, snapshot);

test("plan declares the params its intent requires", async () => {
  const { skill } = await plan("create_ticket", { subject: "Fix login" });
  assert.deepEqual(skill.params, ["subject", "priority"]);
});

test("plan keys the compiled skill to the perceived fingerprint", async () => {
  const { skill } = await plan("list_tickets");
  assert.equal(skill.fingerprint, "fp-test");
});

test("plan estimates cold tokens from the snapshot size", async () => {
  const { tokens, estimated } = await plan("list_tickets");
  assert.ok(estimated && tokens.input > snapshot.approxTokens);
});

test("plan rejects an intent with no heuristic recipe", async () => {
  await assert.rejects(() => plan("unknown_intent"), /No heuristic recipe/);
});
