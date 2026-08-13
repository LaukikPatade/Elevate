import { rmSync } from "node:fs";
import { executeIntent } from "../orchestrator.js";
import { JsonSkillStore } from "../skills/store.js";
import { StaticCredentialSource } from "../auth/credentials.js";
import { intentOf, type SystemDefinition } from "../systems/definition.js";
import { internalCrm, INTERNAL_CRM_DEMO_CREDENTIALS } from "../systems/internal-crm.js";
import { startFixtureServer } from "./fixture-server.js";
import type { Intent, RunResult } from "../types.js";

const SKILLS_FILE = new URL("../../skills-db/skills.json", import.meta.url);
const BAR_WIDTH = 28;

interface DemoOptions {
  intent: string;
  params: Record<string, string>;
  runs: number;
  headed: boolean;
  keep: boolean;
}

function parseArgs(argv: string[]): DemoOptions {
  const options: DemoOptions = {
    intent: "create_ticket",
    params: { subject: "Reset adjuster portal password", priority: "High" },
    runs: 5,
    headed: false,
    keep: false,
  };
  let paramsOverridden = false;

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--intent":
        options.intent = argv[++i];
        break;
      case "--runs":
        options.runs = parseInt(argv[++i], 10);
        break;
      case "--headed":
        options.headed = true;
        break;
      case "--keep":
        options.keep = true;
        break;
      case "--param": {
        if (!paramsOverridden) {
          options.params = {};
          paramsOverridden = true;
        }
        const [key, ...rest] = argv[++i].split("=");
        options.params[key] = rest.join("=");
        break;
      }
    }
  }
  return options;
}

const bar = (value: number, max: number): string => {
  const filled = max <= 0 ? 0 : Math.round((value / max) * BAR_WIDTH);
  return "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);
};

function report(results: RunResult[]): void {
  const coldTokens = results.find((r) => r.path === "cold")?.tokens.total ?? 0;
  const estimated = results.some((r) => r.path === "cold" && r.tokensEstimated);

  console.log("\n┌─────┬────────┬──────┬──────────────┬────────┐");
  console.log("│ run │ path   │  ok  │ planner tok  │   ms   │");
  console.log("├─────┼────────┼──────┼──────────────┼────────┤");
  results.forEach((r, i) => {
    const tokens = r.tokens.total + (r.path === "cold" && estimated ? "*" : "");
    console.log(
      `│ ${String(i + 1).padStart(3)} │ ${r.path.padEnd(6)} │ ${(r.ok ? "yes" : "NO").padEnd(4)} │ ${tokens.padStart(12)} │ ${String(r.ms).padStart(6)} │`,
    );
  });
  console.log("└─────┴────────┴──────┴──────────────┴────────┘");

  const elevateTotal = results.reduce((sum, r) => sum + r.tokens.total, 0);
  const naiveTotal = coldTokens * results.length;
  const saved = naiveTotal - elevateTotal;
  const savedPct = naiveTotal > 0 ? ((saved / naiveTotal) * 100).toFixed(1) : "0.0";
  const factor = elevateTotal > 0 ? (naiveTotal / elevateTotal).toFixed(1) + "×" : "n/a";

  console.log("\n  Amortized planner cost per run (cumulative avg):");
  let cumulative = 0;
  const averages = results.map((r, i) => (cumulative += r.tokens.total) / (i + 1));
  averages.forEach((avg, i) =>
    console.log(`   run ${String(i + 1).padStart(2)} │ ${bar(avg, averages[0])} ${Math.round(avg)} tok/run`),
  );

  console.log("\n  ── Summary ─────────────────────────────────────────");
  console.log(
    `   cold compile cost .......... ${coldTokens} tok${estimated ? "  (*estimated — heuristic planner)" : "  (measured)"}`,
  );
  console.log(`   warm replay cost ........... 0 tok/run`);
  console.log(`   Elevate total (${results.length} runs) ...... ${elevateTotal} tok`);
  console.log(`   Naive re-reason total ...... ${naiveTotal} tok`);
  console.log(`   tokens saved ............... ${saved} tok  (${savedPct}%)`);
  console.log(`   efficiency ................. ${factor} cheaper than re-reasoning`);
  console.log("  ────────────────────────────────────────────────────\n");
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (!options.keep) rmSync(SKILLS_FILE, { force: true });

  const fixture = await startFixtureServer();
  const system: SystemDefinition = { ...internalCrm, baseUrl: fixture.url };
  const credentials = new StaticCredentialSource(INTERNAL_CRM_DEMO_CREDENTIALS);
  const intent: Intent = { name: options.intent, params: options.params };

  console.log(`\n▶ Elevate — system="${system.id}" (owned) intent="${intent.name}"`);
  console.log(
    `  target=${fixture.url}  params=${JSON.stringify(intent.params)}  runs=${options.runs}  planner=${process.env.GROQ_API_KEY ? "groq" : process.env.ANTHROPIC_API_KEY ? "llm" : "heuristic"}`,
  );

  try {
    const definition = intentOf(system, intent.name);
    if (definition?.mutating) {
      const gated = await executeIntent(system, intent, {
        store: new JsonSkillStore(),
        credentials,
        headless: !options.headed,
        confirm: false,
      });
      console.log(`\n  Confirmation gate (no confirm): status=${gated.status}`);
      console.log(`   ${gated.pendingConfirmation ?? "(no pending write)"}`);
      console.log("   → nothing was written to the system of record.");
    }

    const results: RunResult[] = [];
    for (let i = 0; i < options.runs; i++) {
      const result = await executeIntent(system, intent, {
        store: new JsonSkillStore(),
        credentials,
        headless: !options.headed,
        confirm: true,
      });
      console.log(
        `  run ${i + 1}/${options.runs}: ${result.path}${result.ok ? " ✓" : " ✗"} (${result.tokens.total} tok, ${result.ms}ms)`,
      );
      results.push(result);
    }

    const tickets = results.at(-1)?.data.tickets;
    if (tickets) {
      console.log("\n  Extracted tickets (sample):");
      console.log("   " + String(tickets).slice(0, 300).replace(/\n/g, " "));
    }

    report(results);
  } finally {
    await fixture.close();
  }
}

main().catch((err) => {
  console.error("\n✗ demo failed:", err.message);
  process.exit(1);
});
