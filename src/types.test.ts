import { test } from "node:test";
import assert from "node:assert/strict";
import { makeTokenUsage } from "./types.js";

test("token usage total sums input and output", () => {
  assert.equal(makeTokenUsage(120, 30).total, 150);
});
