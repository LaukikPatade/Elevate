import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeSteps } from "./emit.js";

test("normalizeSteps drops a navigate step that has no url", () => {
  const steps = normalizeSteps([{ action: "navigate" }, { action: "click", target: { primary: { strategy: "testid", value: "go" } } }]);
  assert.deepEqual(steps.map((s) => s.action), ["click"]);
});

test("normalizeSteps coerces an out-of-enum locator strategy to css", () => {
  const steps = normalizeSteps([{ action: "click", target: { primary: { strategy: "id", value: "#go" } } }]);
  assert.equal(steps[0].target?.primary.strategy, "css");
});

test("normalizeSteps downgrades valueEquals to textVisible when the target is unusable", () => {
  const steps = normalizeSteps([{ action: "click", verify: { kind: "valueEquals", value: "{subject}" } }]);
  assert.equal(steps[0].verify?.kind, "textVisible");
});
