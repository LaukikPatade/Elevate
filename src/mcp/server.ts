import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z, type ZodRawShape } from "zod";
import { executeIntent } from "../orchestrator.js";
import { JsonSkillStore } from "../skills/store.js";
import { StaticCredentialSource } from "../auth/credentials.js";
import { internalCrm, INTERNAL_CRM_DEMO_CREDENTIALS } from "../systems/internal-crm.js";
import type { SystemDefinition } from "../systems/definition.js";
import type { RunResult } from "../types.js";
import { startFixtureServer } from "../cli/fixture-server.js";

const store = new JsonSkillStore();
const credentials = new StaticCredentialSource(INTERNAL_CRM_DEMO_CREDENTIALS);

const fixture = await startFixtureServer(4599);
const system: SystemDefinition = { ...internalCrm, baseUrl: fixture.url };

function summarize(result: RunResult) {
  return {
    ok: result.ok,
    status: result.status,
    path: result.path,
    plannerTokens: result.tokens.total,
    tokensEstimated: result.tokensEstimated,
    failure: result.failure,
    pendingConfirmation: result.pendingConfirmation,
    ms: result.ms,
    data: result.data,
    steps: result.steps.map((s) => ({
      action: s.step.action,
      ok: s.ok,
      selfHealed: s.selfHealed,
      observation: s.observation,
      error: s.error,
    })),
  };
}

async function run(name: string, params: Record<string, string | number>, confirm?: boolean) {
  const result = await executeIntent(system, { name, params }, { store, credentials, confirm });
  return { content: [{ type: "text" as const, text: JSON.stringify(summarize(result), null, 2) }] };
}

const server = new McpServer({ name: "elevate", version: "0.1.0" });

server.tool(
  "list_intents",
  `List the verified intents Elevate exposes for the "${system.id}" system.`,
  {},
  () => ({
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          system.intents.map((intent) => ({
            name: intent.name,
            description: intent.description,
            params: intent.params,
            mutating: intent.mutating,
          })),
          null,
          2,
        ),
      },
    ],
  }),
);

server.tool(
  "execute_intent",
  `Run any verified intent on the "${system.id}" system by name. Mutating intents require confirm:true.`,
  {
    intent: z.string(),
    params: z.record(z.union([z.string(), z.number()])).optional(),
    confirm: z.boolean().optional(),
  },
  ({ intent, params, confirm }) => run(intent, params ?? {}, confirm),
);

for (const intent of system.intents) {
  const shape: ZodRawShape = {};
  for (const spec of intent.params) {
    shape[spec.name] = spec.required
      ? z.string().describe(spec.description ?? "")
      : z.string().optional().describe(spec.description ?? "");
  }
  if (intent.mutating) shape.confirm = z.boolean().optional();

  server.tool(intent.name, intent.description, shape, (args: Record<string, unknown>) => {
    const { confirm, ...rest } = args;
    const params: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined) params[key] = value as string;
    }
    return run(intent.name, params, confirm as boolean | undefined);
  });
}

await server.connect(new StdioServerTransport());
