import type { Page } from "playwright";
import { makeTokenUsage, type Intent, type Locator, type PageSnapshot, type Skill, type Step } from "../types.js";
import type { SystemDefinition } from "../systems/definition.js";
import type { Planner, PlanOutput } from "./planner.js";
import {
  EMIT_SKILL_DESCRIPTION,
  HEAL_INPUT_SCHEMA,
  PICK_LOCATOR_DESCRIPTION,
  SKILL_INPUT_SCHEMA,
  harvestHealNodes,
  healPrompt,
  normalizeLocator,
  normalizeSteps,
  planPrompt,
} from "./emit.js";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

interface ToolCallResult {
  args: Record<string, unknown>;
  input: number;
  output: number;
}

async function callTool(
  prompt: string,
  tool: { name: string; description: string; parameters: unknown },
): Promise<ToolCallResult> {
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
      tools: [{ type: "function", function: tool }],
      tool_choice: { type: "function", function: { name: tool.name } },
    }),
  });

  if (!response.ok) {
    throw new Error(`groq ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }> } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const raw = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!raw) throw new Error("groq returned no tool call");

  return {
    args: JSON.parse(raw) as Record<string, unknown>,
    input: json.usage?.prompt_tokens ?? 0,
    output: json.usage?.completion_tokens ?? 0,
  };
}

export class GroqPlanner implements Planner {
  readonly name = "groq" as const;

  async plan(intent: Intent, system: SystemDefinition, snapshot: PageSnapshot): Promise<PlanOutput> {
    const { args, input, output } = await callTool(planPrompt(intent, system, snapshot), {
      name: "emit_skill",
      description: EMIT_SKILL_DESCRIPTION,
      parameters: SKILL_INPUT_SCHEMA,
    });
    const emitted = args as { params?: string[]; steps?: unknown };

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
    const prompt = healPrompt(step, nodes);
    try {
      const { args } = await callTool(prompt, {
        name: "pick_locator",
        description: PICK_LOCATOR_DESCRIPTION,
        parameters: HEAL_INPUT_SCHEMA,
      });
      return normalizeLocator(args);
    } catch {
      return null;
    }
  }
}
