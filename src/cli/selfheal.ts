import { rmSync } from "node:fs";
import { executeIntent } from "../orchestrator.js";
import { JsonSkillStore } from "../skills/store.js";
import { StaticCredentialSource } from "../auth/credentials.js";
import { internalCrm, INTERNAL_CRM_DEMO_CREDENTIALS } from "../systems/internal-crm.js";
import type { SystemDefinition } from "../systems/definition.js";
import { startFixtureServer } from "./fixture-server.js";
import type { Intent } from "../types.js";

const SKILLS_FILE = new URL("../../skills-db/skills.json", import.meta.url);
const intent: Intent = { name: "create_ticket", params: { subject: "Escalate portal outage", priority: "High" } };

async function main(): Promise<void> {
  rmSync(SKILLS_FILE, { force: true });
  const fixture = await startFixtureServer();
  const system: SystemDefinition = { ...internalCrm, baseUrl: fixture.url };
  const credentials = new StaticCredentialSource(INTERNAL_CRM_DEMO_CREDENTIALS);
  const store = new JsonSkillStore();
  const run = () => executeIntent(system, intent, { store, credentials, confirm: true });

  try {
    console.log("1) cold compile …");
    const cold = await run();
    console.log(`   path=${cold.path} ok=${cold.ok}`);

    const skill = store.getLatest(system.id, intent.name)!;
    const commitStep = skill.steps.find((s) => s.commit)!;
    commitStep.target = { primary: { strategy: "testid", value: "Create ticket" }, fallbacks: [] };
    store.put(skill);
    console.log("2) broke the create-ticket locator (testid=Create ticket no longer matches)");

    console.log("3) warm replay …");
    const warm = await run();
    const healedStep = warm.steps.find((s) => s.step.commit);
    console.log(`   path=${warm.path} ok=${warm.ok}`);
    console.log(`   commit step selfHealed=${healedStep?.selfHealed} ok=${healedStep?.ok}`);
    console.log(`   skill.stats.selfHeals=${store.getLatest(system.id, intent.name)!.stats.selfHeals}`);

    console.log(
      warm.ok && healedStep?.selfHealed
        ? "\n✓ Self-heal recovered a broken skill in place — no full recompile."
        : "\n✗ Self-heal did not trigger as expected.",
    );
  } finally {
    await fixture.close();
  }
}

main().catch((err) => {
  console.error("selfheal failed:", err.message);
  process.exit(1);
});
