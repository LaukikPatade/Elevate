import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonAuditLog, type AuditEntry } from "./log.js";

const entry = (): AuditEntry => ({
  ts: "2026-07-18T00:00:00Z",
  system: "internal-crm",
  intent: "create_ticket",
  params: { subject: "Fix login" },
  status: "ok",
  path: "warm",
  verifiesPassed: ['value "Fix login" present'],
});

test("an appended entry is retrievable by a new reader of the same log", () => {
  const file = join(mkdtempSync(join(tmpdir(), "elevate-audit-")), "audit.log");
  new JsonAuditLog(file).append(entry());
  assert.equal(new JsonAuditLog(file).all()[0]?.intent, "create_ticket");
});
