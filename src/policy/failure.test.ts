import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyFailure } from "./failure.js";
import type { StepResult } from "../types.js";

const step = (over: Partial<StepResult> = {}): StepResult => ({
  step: { action: "click" },
  ok: false,
  usedFallback: false,
  selfHealed: false,
  ...over,
});

test("a failed auth step classifies as access revoked", () => {
  assert.equal(
    classifyFailure({ steps: [step()], currentFingerprint: "fp", authFailed: true }),
    "access_revoked",
  );
});

test("a drifted fingerprint classifies as system changed", () => {
  assert.equal(
    classifyFailure({
      steps: [step()],
      cachedFingerprint: "fp-old",
      currentFingerprint: "fp-new",
      authFailed: false,
    }),
    "system_changed",
  );
});

test("a self-heal on the failing run classifies as system changed", () => {
  assert.equal(
    classifyFailure({
      steps: [step({ selfHealed: true })],
      currentFingerprint: "fp",
      authFailed: false,
    }),
    "system_changed",
  );
});

test("a step failure with unchanged structure classifies as skill wrong", () => {
  assert.equal(
    classifyFailure({
      steps: [step()],
      cachedFingerprint: "fp",
      currentFingerprint: "fp",
      authFailed: false,
    }),
    "skill_wrong",
  );
});
