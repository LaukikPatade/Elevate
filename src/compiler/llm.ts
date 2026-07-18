import Anthropic from "@anthropic-ai/sdk";
import type { Page } from "playwright";
import { makeTokenUsage, type Intent, type Locator, type PageSnapshot, type Skill, type Step } from "../types.js";
import { intentOf, type SystemDefinition } from "../systems/definition.js";
import type { Planner, PlanOutput } from "./planner.js";

const PLAN_MODEL = "claude-opus-4-8";
const HEAL_MODEL = "claude-sonnet-5";
const MAX_SNAPSHOT_NODES = 120;
const MAX_HEAL_NODES = 80;

const LOCATOR_SCHEMA = {
  type: "object",
  properties: {
    strategy: { type: "string", enum: ["role", "text", "placeholder", "testid", "css"] },
    role: { type: "string" },
    value: { type: "string" },
    nth: { type: "number" },
  },
  required: ["strategy", "value"],
};

const SKILL_TOOL = {
  name: "emit_skill",
  description:
    "Emit a deterministic, parameterized browser-action skill that fulfils the intent.",
  input_schema: {
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
                  enum: ["urlIncludes", "textVisible", "elementVisible", "valueEquals"],
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
  },
};

const HEAL_TOOL = {
  name: "pick_locator",
  description: "Pick the locator that best matches the intended element.",
  input_schema: {
    type: "object" as const,
    properties: LOCATOR_SCHEMA.properties,
    required: ["strategy", "value"],
  },
};

function planPrompt(intent: Intent, system: SystemDefinition, snapshot: PageSnapshot): string {
  const definition = intentOf(system, intent.name);
  return [
    "You are compiling a reusable web-action skill for an AI agent operating a system its owner controls.",
    `SYSTEM: ${system.id}`,
    `START URL: ${snapshot.url}`,
    `INTENT: ${intent.name} — ${definition?.description ?? ""}`,
    `PARAMS: ${JSON.stringify(intent.params)}`,
    `MUTATING: ${definition?.mutating ? "yes — writes to the system of record" : "no — read only"}`,
    "",
    "Interactive elements on the page:",
    ...snapshot.nodes
      .slice(0, MAX_SNAPSHOT_NODES)
      .map((n) => `- ${n.role} "${n.name}"${n.testid ? ` [testid=${n.testid}]` : ""}`),
    "",
    "Rules:",
    "- Parameterize values with {param} using the intent param names.",
    "- Prefer testid or role+name locators; add css fallbacks.",
    "- If the intent is mutating, set commit:true on the single step that commits the write.",
    "- Verify the decisive step. For a write, prefer valueEquals re-reading the saved record.",
    "- Never submit payment. Never store credentials.",
  ].join("\n");
}

export class LlmPlanner implements Planner {
  readonly name = "llm" as const;
  private client = new Anthropic();

  async plan(intent: Intent, system: SystemDefinition, snapshot: PageSnapshot): Promise<PlanOutput> {
    const response = await this.client.messages.create({
      model: PLAN_MODEL,
      max_tokens: 2000,
      tools: [SKILL_TOOL],
      tool_choice: { type: "tool", name: SKILL_TOOL.name },
      messages: [{ role: "user", content: planPrompt(intent, system, snapshot) }],
    });

    const block = response.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") throw new Error("planner returned no skill");
    const emitted = block.input as { params: string[]; steps: Step[] };

    const skill: Skill = {
      system: system.id,
      intent: intent.name,
      fingerprint: snapshot.fingerprint,
      params: emitted.params ?? [],
      steps: emitted.steps ?? [],
      compiledBy: "llm",
      createdAt: new Date().toISOString(),
      stats: { runs: 0, successes: 0, selfHeals: 0 },
    };

    return {
      skill,
      tokens: makeTokenUsage(response.usage.input_tokens, response.usage.output_tokens),
      estimated: false,
    };
  }

  async heal(step: Step, page: Page): Promise<Locator | null> {
    const nodes = await page
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
      .catch(() => [] as Array<{ role: string; name: string; testid: string }>);

    const response = await this.client.messages.create({
      model: HEAL_MODEL,
      max_tokens: 300,
      tools: [HEAL_TOOL],
      tool_choice: { type: "tool", name: HEAL_TOOL.name },
      messages: [
        {
          role: "user",
          content: `Intended step: ${JSON.stringify(step)}\nAvailable elements: ${JSON.stringify(nodes)}\nReturn the best locator.`,
        },
      ],
    });

    const block = response.content.find((b) => b.type === "tool_use");
    return block && block.type === "tool_use" ? (block.input as Locator) : null;
  }
}
