import type { Page } from "playwright";
import { makeTokenUsage, type Intent, type Locator, type PageSnapshot, type Skill, type Step } from "../types.js";
import type { SystemDefinition } from "../systems/definition.js";
import type { Planner, PlanOutput } from "./planner.js";
import {
  harvestHealNodes,
  healPrompt,
  normalizeLocator,
  normalizeSteps,
  planPrompt,
} from "./emit.js";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "openai/gpt-oss-120b";

const PLAN_JSON_SUFFIX =
  '\n\nReturn ONLY a json object with keys "params" (array of strings) and "steps" (array), matching the example shape above. No prose, no code fences.';
const HEAL_JSON_SUFFIX =
  '\n\nReturn ONLY a json object for one locator, e.g. {"strategy":"testid","value":"create"}. No prose, no code fences.';

interface JsonResult {
  data: Record<string, unknown>;
  input: number;
  output: number;
}

function parseJsonObject(text: string): Record<string, unknown> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("groq returned no json object");
  return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
}

async function callJson(prompt: string): Promise<JsonResult> {
  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    throw new Error(`groq ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("groq returned no content");

  return {
    data: parseJsonObject(content),
    input: json.usage?.prompt_tokens ?? 0,
    output: json.usage?.completion_tokens ?? 0,
  };
}

export class GroqPlanner implements Planner {
  readonly name = "groq" as const;

  async plan(intent: Intent, system: SystemDefinition, snapshot: PageSnapshot): Promise<PlanOutput> {
    const { data, input, output } = await callJson(planPrompt(intent, system, snapshot) + PLAN_JSON_SUFFIX);
    const emitted = data as { params?: string[]; steps?: unknown };

    const skill: Skill = {
      system: system.id,
      intent: intent.name,
      fingerprint: snapshot.fingerprint,
      params: emitted.params ?? [],
      steps: normalizeSteps(emitted.steps),
      compiledBy: "groq",
      createdAt: new Date().toISOString(),
      stats: { runs: 0, successes: 0, selfHeals: 0 },
    };

    return { skill, tokens: makeTokenUsage(input, output), estimated: false };
  }

  async heal(step: Step, page: Page): Promise<Locator | null> {
    const nodes = await harvestHealNodes(page);
    try {
      const { data } = await callJson(healPrompt(step, nodes) + HEAL_JSON_SUFFIX);
      return normalizeLocator(data);
    } catch {
      return null;
    }
  }
}
