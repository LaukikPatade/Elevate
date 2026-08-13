export interface Intent {
  name: string;
  params: Record<string, string | number>;
}

export type LocatorStrategy = "role" | "text" | "placeholder" | "testid" | "css";

export interface Locator {
  strategy: LocatorStrategy;
  role?: string;
  value: string;
  nth?: number;
}

export interface RobustTarget {
  primary: Locator;
  fallbacks: Locator[];
}

export type ActionType =
  | "navigate"
  | "type"
  | "click"
  | "select"
  | "waitFor"
  | "extract";

export interface Verify {
  kind: "urlIncludes" | "textVisible" | "elementVisible" | "valueEquals";
  value?: string;
  target?: Locator;
}

export interface Step {
  action: ActionType;
  target?: RobustTarget;
  value?: string;
  verify?: Verify;
  commit?: boolean;
  note?: string;
}

export interface SkillStats {
  runs: number;
  successes: number;
  selfHeals: number;
}

export interface Skill {
  system: string;
  intent: string;
  fingerprint: string;
  params: string[];
  steps: Step[];
  compiledBy: "heuristic" | "llm" | "groq";
  createdAt: string;
  stats: SkillStats;
}

export interface SemanticNode {
  role: string;
  name: string;
  value?: string;
  testid?: string;
  placeholder?: string;
  tag?: string;
}

export interface PageSnapshot {
  url: string;
  title: string;
  nodes: SemanticNode[];
  fingerprint: string;
  approxTokens: number;
}

export interface StepResult {
  step: Step;
  ok: boolean;
  usedFallback: boolean;
  selfHealed: boolean;
  observation?: string;
  error?: string;
}

export type RunStatus = "ok" | "confirmation_required" | "failed";

export type FailureClass =
  | "system_changed"
  | "access_revoked"
  | "skill_wrong"
  | "intent_impossible";

export interface TokenUsage {
  input: number;
  output: number;
  get total(): number;
}

export interface RunResult {
  intent: Intent;
  system: string;
  path: "cold" | "warm";
  status: RunStatus;
  ok: boolean;
  steps: StepResult[];
  data: Record<string, unknown>;
  tokens: TokenUsage;
  tokensEstimated: boolean;
  ms: number;
  failure?: FailureClass;
  pendingConfirmation?: string;
}

export function makeTokenUsage(input = 0, output = 0): TokenUsage {
  return {
    input,
    output,
    get total() {
      return this.input + this.output;
    },
  };
}
