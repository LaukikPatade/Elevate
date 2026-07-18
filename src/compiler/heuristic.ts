import type { Page } from "playwright";
import { makeTokenUsage, type Intent, type Locator, type PageSnapshot, type Skill, type Step } from "../types.js";
import { intentOf, type SystemDefinition } from "../systems/definition.js";
import type { Planner, PlanOutput } from "./planner.js";

const PROMPT_OVERHEAD_TOKENS = 600;
const TOKENS_PER_STEP = 40;
const PLAN_SCAFFOLD_TOKENS = 200;

const role = (roleName: string, value: string): Locator => ({ strategy: "role", role: roleName, value });

export class HeuristicPlanner implements Planner {
  readonly name = "heuristic" as const;

  async plan(intent: Intent, system: SystemDefinition, snapshot: PageSnapshot): Promise<PlanOutput> {
    const definition = intentOf(system, intent.name);
    if (!definition?.build) {
      throw new Error(
        `No heuristic recipe for "${intent.name}" on "${system.id}". Set ANTHROPIC_API_KEY to use the LLM planner.`,
      );
    }
    const steps = definition.build(intent.params);

    const skill: Skill = {
      system: system.id,
      intent: intent.name,
      fingerprint: snapshot.fingerprint,
      params: definition.params.map((spec) => spec.name),
      steps,
      compiledBy: "heuristic",
      createdAt: new Date().toISOString(),
      stats: { runs: 0, successes: 0, selfHeals: 0 },
    };

    const tokens = makeTokenUsage(
      snapshot.approxTokens + PROMPT_OVERHEAD_TOKENS,
      steps.length * TOKENS_PER_STEP + PLAN_SCAFFOLD_TOKENS,
    );
    return { skill, tokens, estimated: true };
  }

  async heal(step: Step, page: Page): Promise<Locator | null> {
    const wanted = (step.target?.primary.value || step.value || "")
      .replace(/[{}]/g, "")
      .toLowerCase();
    if (!wanted) return null;

    const match = await page.evaluate((needle) => {
      for (const el of Array.from(
        document.querySelectorAll("a, button, input, [role], [data-test]"),
      )) {
        const name = (
          el.getAttribute("aria-label") ||
          el.getAttribute("placeholder") ||
          (el as HTMLInputElement).value ||
          el.textContent ||
          ""
        )
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
        if (!name.includes(needle)) continue;

        const tag = el.tagName.toLowerCase();
        const inputType = (el as HTMLInputElement).type;
        const isButtonInput =
          tag === "input" && (inputType === "submit" || inputType === "button");
        const resolvedRole =
          el.getAttribute("role") ||
          (tag === "a" ? "link" : tag === "button" || isButtonInput ? "button" : "textbox");
        return { role: resolvedRole, name: name.slice(0, 40) };
      }
      return null;
    }, wanted);

    return match ? role(match.role, match.name) : null;
  }
}
