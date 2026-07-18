import { test } from "node:test";
import assert from "node:assert/strict";
import { fingerprintOf } from "./perceive.js";
import type { SemanticNode } from "../types.js";

const page: SemanticNode[] = [
  { role: "textbox", name: "Username", testid: "username" },
  { role: "button", name: "Login", testid: "login-button" },
];

test("fingerprint ignores node ordering", () => {
  assert.equal(fingerprintOf(page), fingerprintOf([...page].reverse()));
});

test("fingerprint changes when structure changes", () => {
  const restructured: SemanticNode[] = [...page, { role: "link", name: "Cart" }];
  assert.notEqual(fingerprintOf(page), fingerprintOf(restructured));
});

test("fingerprint ignores volatile text beyond the name prefix", () => {
  const volatile: SemanticNode[] = [
    { role: "textbox", name: "Username", testid: "username" },
    { role: "button", name: "Login now — 3 attempts left", testid: "login-button" },
  ];
  const stable: SemanticNode[] = [
    { role: "textbox", name: "Username", testid: "username" },
    { role: "button", name: "Login now — 7 attempts left", testid: "login-button" },
  ];
  assert.equal(fingerprintOf(volatile), fingerprintOf(stable));
});
