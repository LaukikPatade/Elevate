import { appendFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FailureClass, RunStatus } from "../types.js";

export interface AuditEntry {
  ts: string;
  system: string;
  intent: string;
  params: Record<string, string | number>;
  status: RunStatus;
  path: "cold" | "warm";
  verifiesPassed: string[];
  failure?: FailureClass;
}

export interface AuditLog {
  append(entry: AuditEntry): void;
  all(): AuditEntry[];
}

const DEFAULT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "skills-db");

export class JsonAuditLog implements AuditLog {
  constructor(private readonly file = join(DEFAULT_DIR, "audit.log")) {
    mkdirSync(dirname(this.file), { recursive: true });
  }

  append(entry: AuditEntry): void {
    appendFileSync(this.file, JSON.stringify(entry) + "\n");
  }

  all(): AuditEntry[] {
    if (!existsSync(this.file)) return [];
    return readFileSync(this.file, "utf8")
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as AuditEntry);
  }
}
