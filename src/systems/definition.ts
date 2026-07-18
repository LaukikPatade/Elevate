import type { Step } from "../types.js";

export interface ParamSpec {
  name: string;
  required: boolean;
  description?: string;
}

export interface IntentDefinition {
  name: string;
  description: string;
  params: ParamSpec[];
  mutating: boolean;
  build?: (params: Record<string, string | number>) => Step[];
}

export interface AuthSpec {
  loginSteps: Step[];
  credentialKeys: string[];
}

export interface SystemDefinition {
  id: string;
  baseUrl: string;
  auth?: AuthSpec;
  intents: IntentDefinition[];
}

export function intentOf(def: SystemDefinition, name: string): IntentDefinition | undefined {
  return def.intents.find((intent) => intent.name === name);
}

export function missingRequiredParams(
  intent: IntentDefinition,
  params: Record<string, string | number>,
): string[] {
  return intent.params
    .filter((spec) => spec.required)
    .filter((spec) => params[spec.name] === undefined || params[spec.name] === "")
    .map((spec) => spec.name);
}
