import type { Page } from "playwright";
import type { Intent, Locator, PageSnapshot, Skill, Step, TokenUsage } from "../types.js";
import type { SystemDefinition } from "../systems/definition.js";

export interface PlanOutput {
  skill: Skill;
  tokens: TokenUsage;
  estimated: boolean;
}

export interface Planner {
  readonly name: "heuristic" | "llm";
  plan(intent: Intent, system: SystemDefinition, snapshot: PageSnapshot): Promise<PlanOutput>;
  heal(step: Step, page: Page): Promise<Locator | null>;
}
