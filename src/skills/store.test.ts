import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonSkillStore } from "./store.js";
import type { Skill } from "../types.js";

const skill = (fingerprint: string, createdAt: string): Skill => ({
  system: "internal-crm",
  intent: "create_ticket",
  fingerprint,
  params: ["subject"],
  steps: [],
  compiledBy: "heuristic",
  createdAt,
  stats: { runs: 0, successes: 0, selfHeals: 0 },
});

const freshStore = () =>
  new JsonSkillStore(join(mkdtempSync(join(tmpdir(), "elevate-")), "skills.json"));

test("get returns the skill matching system, intent and fingerprint", () => {
  const store = freshStore();
  store.put(skill("fp-a", "2026-01-01T00:00:00Z"));
  assert.equal(store.get("internal-crm", "create_ticket", "fp-a")?.fingerprint, "fp-a");
});

test("get misses when the fingerprint has drifted", () => {
  const store = freshStore();
  store.put(skill("fp-a", "2026-01-01T00:00:00Z"));
  assert.equal(store.get("internal-crm", "create_ticket", "fp-b"), null);
});

test("getLatest returns the most recently compiled skill across fingerprints", () => {
  const store = freshStore();
  store.put(skill("fp-a", "2026-01-01T00:00:00Z"));
  store.put(skill("fp-b", "2026-06-01T00:00:00Z"));
  assert.equal(store.getLatest("internal-crm", "create_ticket")?.fingerprint, "fp-b");
});

test("skills persist across store instances", () => {
  const file = join(mkdtempSync(join(tmpdir(), "elevate-")), "skills.json");
  new JsonSkillStore(file).put(skill("fp-a", "2026-01-01T00:00:00Z"));
  assert.equal(
    new JsonSkillStore(file).get("internal-crm", "create_ticket", "fp-a")?.fingerprint,
    "fp-a",
  );
});
