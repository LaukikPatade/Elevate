import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Skill } from "../types.js";

export interface SkillStore {
  get(system: string, intent: string, fingerprint: string): Skill | null;
  getLatest(system: string, intent: string): Skill | null;
  put(skill: Skill): void;
  all(): Skill[];
}

const DEFAULT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "skills-db");

const keyOf = (system: string, intent: string, fingerprint: string) =>
  `${system}::${intent}::${fingerprint}`;

export class JsonSkillStore implements SkillStore {
  private skills = new Map<string, Skill>();

  constructor(private readonly file = join(DEFAULT_DIR, "skills.json")) {
    mkdirSync(dirname(this.file), { recursive: true });
    this.load();
  }

  get(system: string, intent: string, fingerprint: string): Skill | null {
    return this.skills.get(keyOf(system, intent, fingerprint)) ?? null;
  }

  getLatest(system: string, intent: string): Skill | null {
    let latest: Skill | null = null;
    for (const skill of this.skills.values()) {
      if (skill.system !== system || skill.intent !== intent) continue;
      if (!latest || skill.createdAt > latest.createdAt) latest = skill;
    }
    return latest;
  }

  put(skill: Skill): void {
    this.skills.set(keyOf(skill.system, skill.intent, skill.fingerprint), skill);
    writeFileSync(this.file, JSON.stringify(this.all(), null, 2));
  }

  all(): Skill[] {
    return [...this.skills.values()];
  }

  private load(): void {
    if (!existsSync(this.file)) return;
    try {
      for (const skill of JSON.parse(readFileSync(this.file, "utf8")) as Skill[]) {
        this.skills.set(keyOf(skill.system, skill.intent, skill.fingerprint), skill);
      }
    } catch {
      this.skills.clear();
    }
  }
}
