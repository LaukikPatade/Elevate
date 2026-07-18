import {
  makeTokenUsage,
  type Intent,
  type RunResult,
  type RunStatus,
  type Skill,
  type StepResult,
} from "./types.js";
import { BrowserSession } from "./runtime/browser.js";
import { perceive } from "./runtime/perceive.js";
import { executeSteps } from "./runtime/execute.js";
import { JsonSkillStore, type SkillStore } from "./skills/store.js";
import { HeuristicPlanner } from "./compiler/heuristic.js";
import { LlmPlanner } from "./compiler/llm.js";
import type { Planner } from "./compiler/planner.js";
import { intentOf, missingRequiredParams, type SystemDefinition } from "./systems/definition.js";
import { planConfirmation } from "./policy/confirmation.js";
import { classifyFailure } from "./policy/failure.js";
import { JsonAuditLog, type AuditLog } from "./audit/log.js";
import type { CredentialSource } from "./auth/credentials.js";

export function pickPlanner(): Planner {
  return process.env.ANTHROPIC_API_KEY ? new LlmPlanner() : new HeuristicPlanner();
}

export interface RunOptions {
  store?: SkillStore;
  planner?: Planner;
  audit?: AuditLog;
  credentials?: CredentialSource;
  headless?: boolean;
  confirm?: boolean;
}

function verifiesPassed(steps: StepResult[]): string[] {
  return steps
    .filter((step) => step.step.verify && step.ok && step.observation)
    .map((step) => step.observation as string);
}

export async function executeIntent(
  system: SystemDefinition,
  intent: Intent,
  options: RunOptions = {},
): Promise<RunResult> {
  const store = options.store ?? new JsonSkillStore();
  const planner = options.planner ?? pickPlanner();
  const audit = options.audit ?? new JsonAuditLog();
  const startedAt = Date.now();

  const record = (result: RunResult): RunResult => {
    audit.append({
      ts: new Date().toISOString(),
      system: system.id,
      intent: intent.name,
      params: intent.params,
      status: result.status,
      path: result.path,
      verifiesPassed: verifiesPassed(result.steps),
      failure: result.failure,
    });
    return result;
  };

  const settle = (over: Partial<RunResult> & Pick<RunResult, "path" | "status" | "ok">): RunResult =>
    record({
      intent,
      system: system.id,
      steps: [],
      data: {},
      tokens: makeTokenUsage(),
      tokensEstimated: false,
      ms: Date.now() - startedAt,
      ...over,
    });

  const definition = intentOf(system, intent.name);
  if (!definition) {
    return settle({ path: "cold", status: "failed", ok: false, failure: "intent_impossible" });
  }
  if (missingRequiredParams(definition, intent.params).length > 0) {
    return settle({ path: "cold", status: "failed", ok: false, failure: "intent_impossible" });
  }

  const session = new BrowserSession(options.headless ?? true);
  await session.start();
  try {
    await session.page.goto(system.baseUrl, { waitUntil: "domcontentloaded" });
    const heal = planner.heal.bind(planner);
    const execOptions = { healer: heal, credentials: options.credentials };

    if (system.auth) {
      const login = await executeSteps(session.page, system.auth.loginSteps, intent, execOptions);
      if (!login.ok) {
        return settle({
          path: "cold",
          status: "failed",
          ok: false,
          steps: login.steps,
          failure: classifyFailure({ steps: login.steps, currentFingerprint: "", authFailed: true }),
        });
      }
    }

    const snapshot = await perceive(session.page);
    const cached = store.get(system.id, intent.name, snapshot.fingerprint);
    const path: "cold" | "warm" = cached ? "warm" : "cold";

    let skill: Skill;
    let tokens = makeTokenUsage();
    let tokensEstimated = false;
    if (cached) {
      skill = cached;
    } else {
      const plan = await planner.plan(intent, system, snapshot);
      skill = plan.skill;
      tokens = plan.tokens;
      tokensEstimated = plan.estimated;
    }

    const confirmation = planConfirmation(
      skill.steps,
      definition,
      intent.params,
      options.confirm ?? false,
    );

    if (confirmation.requiresConfirmation) {
      const prefix = await executeSteps(
        session.page,
        skill.steps.slice(0, confirmation.stopBefore),
        intent,
        execOptions,
      );
      return record({
        intent,
        system: system.id,
        path,
        status: "confirmation_required",
        ok: false,
        steps: prefix.steps,
        data: prefix.data,
        tokens,
        tokensEstimated,
        ms: Date.now() - startedAt,
        pendingConfirmation: confirmation.description,
      });
    }

    const outcome = await executeSteps(session.page, skill.steps, intent, execOptions);
    skill.stats.runs++;
    if (outcome.ok) skill.stats.successes++;
    if (outcome.steps.some((step) => step.selfHealed)) skill.stats.selfHeals++;
    if (path === "warm" || outcome.ok) store.put(skill);

    const status: RunStatus = outcome.ok ? "ok" : "failed";
    return record({
      intent,
      system: system.id,
      path,
      status,
      ok: outcome.ok,
      steps: outcome.steps,
      data: outcome.data,
      tokens,
      tokensEstimated,
      ms: Date.now() - startedAt,
      failure: outcome.ok
        ? undefined
        : classifyFailure({
            steps: outcome.steps,
            cachedFingerprint: cached?.fingerprint,
            currentFingerprint: snapshot.fingerprint,
            authFailed: false,
          }),
    });
  } finally {
    await session.close();
  }
}
