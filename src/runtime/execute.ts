import type { Page } from "playwright";
import type { Intent, Locator, Step, StepResult } from "../types.js";
import type { CredentialSource } from "../auth/credentials.js";
import { resolveOne, resolveRobust } from "./locator.js";

export type Healer = (step: Step, page: Page) => Promise<Locator | null>;

export interface ExecuteOptions {
  healer?: Healer;
  credentials?: CredentialSource;
}

const VERIFY_TIMEOUT_MS = 4000;

export function bind(
  value: string | undefined,
  intent: Intent,
  credentials?: CredentialSource,
): string {
  if (!value) return "";
  const withSecrets = credentials
    ? value.replace(/\{secret:(\w+)\}/g, (_, key) => credentials.get(key) ?? "")
    : value;
  return withSecrets.replace(/\{(\w+)\}/g, (_, key) => String(intent.params[key] ?? ""));
}

async function readValue(page: Page, locator: Locator): Promise<string> {
  const resolved = resolveOne(page, locator);
  await resolved.waitFor({ state: "visible", timeout: VERIFY_TIMEOUT_MS }).catch(() => {});
  const text = await resolved.innerText().catch(() => "");
  if (text) return text;
  return resolved.inputValue().catch(() => "");
}

async function checkVerify(
  page: Page,
  step: Step,
  intent: Intent,
  credentials?: CredentialSource,
): Promise<string | null> {
  const verify = step.verify;
  if (!verify) return null;
  const value = bind(verify.value, intent, credentials);

  switch (verify.kind) {
    case "urlIncludes": {
      const ok = await page
        .waitForURL((url) => url.toString().includes(value), { timeout: VERIFY_TIMEOUT_MS })
        .then(() => true)
        .catch(() => false);
      return ok ? `url includes "${value}"` : null;
    }
    case "textVisible": {
      const ok = await page
        .getByText(value, { exact: false })
        .first()
        .waitFor({ state: "visible", timeout: VERIFY_TIMEOUT_MS })
        .then(() => true)
        .catch(() => false);
      return ok ? `text "${value}" visible` : null;
    }
    case "elementVisible": {
      const ok = await page
        .locator(value || "body")
        .first()
        .waitFor({ state: "visible", timeout: VERIFY_TIMEOUT_MS })
        .then(() => true)
        .catch(() => false);
      return ok ? `element "${value}" visible` : null;
    }
    case "valueEquals": {
      if (!verify.target) return null;
      const actual = await readValue(page, verify.target);
      return actual.includes(value) ? `value "${value}" present` : null;
    }
    default:
      return null;
  }
}

async function applyAction(
  page: Page,
  step: Step,
  intent: Intent,
  result: StepResult,
  options: ExecuteOptions,
): Promise<void> {
  if (step.action === "navigate") {
    await page.goto(bind(step.value, intent, options.credentials), {
      waitUntil: "domcontentloaded",
    });
    return;
  }

  const target = step.target;
  if (!target) throw new Error(`step ${step.action} missing target`);

  let resolved = await resolveRobust(page, target);

  if (!resolved && step.action === "extract") {
    result.observation = "";
    return;
  }

  if (!resolved && options.healer) {
    const fresh = await options.healer(step, page);
    if (fresh) {
      target.fallbacks.push(fresh);
      resolved = await resolveRobust(page, target);
      result.selfHealed = true;
    }
  }
  if (!resolved) throw new Error(`could not locate element for ${step.action}`);
  result.usedFallback = resolved.usedFallback;

  const value = bind(step.value, intent, options.credentials);

  switch (step.action) {
    case "type":
      await resolved.locator.fill(value);
      break;
    case "click":
      await resolved.locator.click();
      break;
    case "select":
      if (value) await resolved.locator.selectOption({ label: value });
      break;
    case "waitFor":
      await resolved.locator.waitFor({ state: "visible" });
      break;
    case "extract":
      result.observation = (await resolved.locator.allInnerTexts().catch(() => [])).join(" | ");
      break;
  }
}

async function runStep(
  page: Page,
  step: Step,
  intent: Intent,
  options: ExecuteOptions,
): Promise<StepResult> {
  const result: StepResult = { step, ok: false, usedFallback: false, selfHealed: false };
  try {
    await applyAction(page, step, intent, result, options);
    const verified = await checkVerify(page, step, intent, options.credentials);
    if (step.verify && !verified) throw new Error(`verify failed: ${step.verify.kind}`);
    result.observation = result.observation ?? verified ?? "ok";
    result.ok = true;
  } catch (err) {
    result.error = (err as Error).message;
  }
  return result;
}

export interface ExecuteOutcome {
  ok: boolean;
  steps: StepResult[];
  data: Record<string, unknown>;
}

export async function executeSteps(
  page: Page,
  steps: Step[],
  intent: Intent,
  options: ExecuteOptions = {},
): Promise<ExecuteOutcome> {
  const results: StepResult[] = [];
  const data: Record<string, unknown> = {};

  for (const step of steps) {
    const result = await runStep(page, step, intent, options);
    results.push(result);
    if (step.action === "extract" && step.value) data[step.value] = result.observation;
    if (!result.ok) break;
  }

  return { ok: results.length > 0 && results.every((r) => r.ok), steps: results, data };
}
