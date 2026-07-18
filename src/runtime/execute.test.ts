import { test } from "node:test";
import assert from "node:assert/strict";
import { bind } from "./execute.js";
import { StaticCredentialSource } from "../auth/credentials.js";
import type { Intent } from "../types.js";

const intent: Intent = { name: "create_ticket", params: { subject: "Backpack", qty: 2 } };

test("bind substitutes declared params into a value", () => {
  assert.equal(bind("add {subject} x{qty}", intent), "add Backpack x2");
});

test("bind resolves an undeclared param to an empty string", () => {
  assert.equal(bind("{missing}", intent), "");
});

test("bind resolves a {secret:key} ref from the credential source only", () => {
  const credentials = new StaticCredentialSource({ password: "s3cret" });
  assert.equal(bind("{secret:password}", intent, credentials), "s3cret");
});
