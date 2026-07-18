import type { FailureClass, StepResult } from "../types.js";

export interface FailureContext {
  steps: StepResult[];
  cachedFingerprint?: string;
  currentFingerprint: string;
  authFailed: boolean;
}

export function classifyFailure(context: FailureContext): FailureClass {
  if (context.authFailed) return "access_revoked";

  const drifted =
    context.cachedFingerprint !== undefined &&
    context.cachedFingerprint !== context.currentFingerprint;
  const healed = context.steps.some((step) => step.selfHealed);
  if (drifted || healed) return "system_changed";

  return "skill_wrong";
}
