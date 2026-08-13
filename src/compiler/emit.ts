import type { Page } from "playwright";
import type { Intent, Locator, PageSnapshot, RobustTarget, Step, Verify } from "../types.js";
import { intentOf, type SystemDefinition } from "../systems/definition.js";

export const MAX_SNAPSHOT_NODES = 120;
export const MAX_HEAL_NODES = 80;

const STRATEGIES = new Set(["role", "text", "placeholder", "testid", "css"]);
const VERIFY_KINDS = new Set(["urlIncludes", "textVisible", "elementVisible", "valueEquals"]);

export const LOCATOR_SCHEMA = {
  type: "object",
  properties: {
    strategy: { type: "string", description: "one of: role, text, placeholder, testid, css" },
    role: { type: "string", description: "ARIA role, required when strategy is role" },
    value: { type: "string", description: "the selector, accessible name, or text to match" },
    nth: { type: "number" },
  },
  required: [] as string[],
};

export const SKILL_INPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    params: { type: "array", items: { type: "string" } },
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["navigate", "type", "click", "select", "waitFor", "extract"],
          },
          target: {
            type: "object",
            properties: {
              primary: LOCATOR_SCHEMA,
              fallbacks: { type: "array", items: LOCATOR_SCHEMA },
            },
          },
          value: { type: "string", description: "literal or {param} reference" },
          commit: {
            type: "boolean",
            description: "true on the single irreversible step that writes to the system of record",
          },
          verify: {
            type: "object",
            properties: {
              kind: {
                type: "string",
                description: "one of: urlIncludes, textVisible, elementVisible, valueEquals",
              },
              value: { type: "string" },
              target: LOCATOR_SCHEMA,
            },
          },
          note: { type: "string" },
        },
        required: ["action"],
      },
    },
  },
  required: ["params", "steps"],
};

export const HEAL_INPUT_SCHEMA = {
  type: "object" as const,
  properties: LOCATOR_SCHEMA.properties,
  required: [] as string[],
};

export const EMIT_SKILL_DESCRIPTION =
  "Emit a deterministic, parameterized browser-action skill that fulfils the intent.";
export const PICK_LOCATOR_DESCRIPTION =
  "Pick the locator that best matches the intended element.";

const EMIT_EXAMPLE = {
  params: ["contact", "outcome"],
  steps: [
    {
      action: "type",
      target: { primary: { strategy: "testid", value: "contact-name" }, fallbacks: [] },
      value: "{contact}",
    },
    {
      action: "select",
      target: { primary: { strategy: "testid", value: "call-outcome" }, fallbacks: [] },
      value: "{outcome}",
    },
    {
      action: "click",
      commit: true,
      target: {
        primary: { strategy: "testid", value: "log-call" },
        fallbacks: [{ strategy: "role", role: "button", value: "Log call" }],
      },
      verify: { kind: "valueEquals", value: "{contact}", target: { strategy: "css", value: ".call:first-child .contact" } },
    },
  ],
};

function field(raw: Record<string, unknown>, key: string): string | undefined {
  const value = raw[key];
  return typeof value === "string" && value ? value : undefined;
}

export function normalizeLocator(raw: unknown): Locator | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;
  const value = field(source, "value");
  if (!value) return null;
  const strategyRaw = field(source, "strategy");
  const strategy = strategyRaw && STRATEGIES.has(strategyRaw) ? (strategyRaw as Locator["strategy"]) : "css";
  const locator: Locator = { strategy, value };
  const role = field(source, "role");
  if (strategy === "role" && role) locator.role = role;
  if (typeof source.nth === "number") locator.nth = source.nth;
  return locator;
}

function normalizeTarget(raw: unknown): RobustTarget | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const source = raw as Record<string, unknown>;
  const fallbacks = Array.isArray(source.fallbacks) ? source.fallbacks : [];
  const locators = [source.primary, ...fallbacks].map(normalizeLocator).filter((l): l is Locator => l !== null);
  if (locators.length === 0) return undefined;
  return { primary: locators[0], fallbacks: locators.slice(1) };
}

function normalizeVerify(raw: unknown): Verify | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const source = raw as Record<string, unknown>;
  const kind = field(source, "kind");
  if (!kind || !VERIFY_KINDS.has(kind)) return undefined;
  const verify: Verify = { kind: kind as Verify["kind"] };
  const value = field(source, "value");
  if (value) verify.value = value;
  const target = normalizeLocator(source.target);
  if (target) verify.target = target;
  else if (verify.kind === "valueEquals") verify.kind = "textVisible";
  return verify;
}

export function normalizeSteps(raw: unknown): Step[] {
  if (!Array.isArray(raw)) return [];
  const steps: Step[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const source = entry as Record<string, unknown>;
    const action = source.action;
    if (typeof action !== "string") continue;
    const value = field(source, "value");
    if (action === "navigate" && !value) continue;
    const step: Step = { action: action as Step["action"] };
    const target = normalizeTarget(source.target);
    if (target) step.target = target;
    if (value) step.value = value;
    if (source.commit === true) step.commit = true;
    const note = field(source, "note");
    if (note) step.note = note;
    const verify = normalizeVerify(source.verify);
    if (verify) step.verify = verify;
    steps.push(step);
  }
  return steps;
}

export function planPrompt(
  intent: Intent,
  system: SystemDefinition,
  snapshot: PageSnapshot,
): string {
  const definition = intentOf(system, intent.name);
  return [
    "You are compiling a reusable web-action skill for an AI agent operating a system its owner controls.",
    `SYSTEM: ${system.id}`,
    `START URL: ${snapshot.url}`,
    `INTENT: ${intent.name} — ${definition?.description ?? ""}`,
    `PARAMS: ${JSON.stringify(intent.params)}`,
    `MUTATING: ${definition?.mutating ? "yes — writes to the system of record" : "no — read only"}`,
    "",
    "Interactive elements on the page (role, name, and testid when present):",
    ...snapshot.nodes
      .slice(0, MAX_SNAPSHOT_NODES)
      .map((n) => `- ${n.role} "${n.name}"${n.testid ? ` [testid=${n.testid}]` : ""}`),
    "",
    "Rules:",
    "- The browser is ALREADY logged in and on this page. Do NOT emit a navigate step.",
    "- Emit one step per UI action, in order. Every type/click/select step MUST have a target.",
    "- Build each target from a testid shown above: target.primary = {strategy:'testid', value:'<the testid>'}.",
    "- Parameterize values with {param} using ONLY the intent param names; never concatenate params.",
    "- If mutating, set commit:true on the single step that submits the write (e.g. the Create button).",
    "- Verify that step with valueEquals: value is the {param} you expect to appear, target is a css locator that re-reads the saved record.",
    "- Never submit payment. Never store credentials.",
    "",
    "Example of the exact shape required (this is a DIFFERENT form — copy the structure, not the values):",
    JSON.stringify(EMIT_EXAMPLE),
  ].join("\n");
}

export interface HealNode {
  role: string;
  name: string;
  testid: string;
}

export function healPrompt(step: Step, nodes: HealNode[]): string {
  const wanted = step.target?.primary.value || step.value || "";
  return [
    "A locator in a cached web skill no longer matches — the page changed.",
    `The step action is "${step.action}" and it was targeting something like "${wanted}".`,
    "Choose the ONE element below that best fulfils that action and return a locator for it.",
    "Prefer {strategy:'testid', value:<the testid>}. If it has no testid, use {strategy:'role', role:<role>, value:<name>}.",
    "Do not reuse the old value.",
    "",
    "Available elements:",
    ...nodes.map((n) => `- role=${n.role} name="${n.name}"${n.testid ? ` testid=${n.testid}` : ""}`),
  ].join("\n");
}

export function harvestHealNodes(page: Page): Promise<HealNode[]> {
  return page
    .evaluate((maxNodes) => {
      return Array.from(document.querySelectorAll("a,button,input,[role],[data-test]"))
        .slice(0, maxNodes)
        .map((el) => ({
          role: el.getAttribute("role") || el.tagName.toLowerCase(),
          name: (el.getAttribute("aria-label") || el.textContent || "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 40),
          testid: el.getAttribute("data-test") || el.getAttribute("data-testid") || "",
        }));
    }, MAX_HEAL_NODES)
    .catch(() => [] as HealNode[]);
}
