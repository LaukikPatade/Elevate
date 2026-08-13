import Anthropic from "@anthropic-ai/sdk";
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

const PLAN_MODEL = "claude-opus-4-8";
const HEAL_MODEL = "claude-sonnet-5";

export class LlmPlanner implements Planner {
  readonly name = "llm" as const;
  private client = new Anthropic();

  async plan(intent: Intent, system: SystemDefinition, snapshot: PageSnapshot): Promise<PlanOutput> {
    const response = await this.client.messages.create({
      model: PLAN_MODEL,
      max_tokens: 2000,
      tools: [{ name: "emit_skill", description: EMIT_SKILL_DESCRIPTION, input_schema: SKILL_INPUT_SCHEMA }],
      tool_choice: { type: "tool", name: "emit_skill" },
      messages: [{ role: "user", content: planPrompt(intent, system, snapshot) }],
    });

    const block = response.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") throw new Error("planner returned no skill");
    const emitted = block.input as { params?: string[]; steps?: unknown };

    const skill: Skill = {
      system: system.id,
      intent: intent.name,
      fingerprint: snapshot.fingerprint,
      params: emitted.params ?? [],
      steps: normalizeSteps(emitted.steps),
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
    const nodes = await harvestHealNodes(page);
    const response = await this.client.messages.create({
      model: HEAL_MODEL,
      max_tokens: 300,
      tools: [{ name: "pick_locator", description: PICK_LOCATOR_DESCRIPTION, input_schema: HEAL_INPUT_SCHEMA }],
      tool_choice: { type: "tool", name: "pick_locator" },
      messages: [{ role: "user", content: healPrompt(step, nodes) }],
    });

    const block = response.content.find((b) => b.type === "tool_use");
    return block && block.type === "tool_use" ? normalizeLocator(block.input) : null;
  }
}
