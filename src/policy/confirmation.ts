import type { Step } from "../types.js";
import type { IntentDefinition } from "../systems/definition.js";

export interface ConfirmationPlan {
  requiresConfirmation: boolean;
  stopBefore: number;
  description: string;
}

function describePending(
  intent: IntentDefinition,
  params: Record<string, string | number>,
): string {
  const bound = intent.params
    .map((spec) => `${spec.name}=${JSON.stringify(params[spec.name] ?? "")}`)
    .join(", ");
  return `Pending write to "${intent.name}"${bound ? ` (${bound})` : ""}. Re-run with confirm to commit.`;
}

export function planConfirmation(
  steps: Step[],
  intent: IntentDefinition,
  params: Record<string, string | number>,
  confirmed: boolean,
): ConfirmationPlan {
  const commitIndex = steps.findIndex((step) => step.commit);
  const requiresConfirmation = intent.mutating && !confirmed;
  return {
    requiresConfirmation,
    stopBefore: commitIndex >= 0 ? commitIndex : 0,
    description: requiresConfirmation ? describePending(intent, params) : "",
  };
}
