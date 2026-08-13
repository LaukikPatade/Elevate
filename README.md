# Elevate

**A verified, self-healing MCP server for the systems you already own.**

Agents can reach modern SaaS through vendor MCPs — but not the legacy and internal web apps that
run the real economy, whose vendor is dead, acquired, or indifferent and will never ship one.
Point Elevate at a system you own or license, and it compiles that system's actions **once** into
deterministic, per-step-verified, parameterized skills; replays them at ~zero planner tokens;
heals when the UI drifts; and exposes the whole system as **one MCP server** your agents call.
Authorization is solved by definition — it's your software.

## How it works

| Layer | What it does |
| --- | --- |
| **Perceive** | Renders the page and distills it to a semantic snapshot (ARIA roles + names + testids) — not screenshots, not raw HTML. Produces a structural fingerprint. |
| **Compile & cache** | On a cache miss, a planner emits a Skill (steps + robust locators + verifies), keyed by `(system, intent, fingerprint)`. |
| **Replay & heal** | On a hit, steps replay deterministically. A broken locator is re-located semantically and patched in place — no full recompile. |
| **Expose** | Every skill is served through one MCP server per system with a uniform tool surface. Agents never see HTML. |

A **system** is described by a `SystemDefinition` (`src/systems/`): its base URL, an auth spec, and
its intents — each with declared params and a `mutating` flag. Intents are data, not code, so a new
system is a new definition, not a new build.

The planner is pluggable (`src/compiler/planner.ts`) — the seam a new backend drops into
without touching any caller:

- **HeuristicPlanner** — offline recipes carried on the system definition. Runs with no API key. Reports cold tokens as a *model estimate*.
- **LlmPlanner** — Claude-backed, compiles systems that have no recipe. Reports *measured* tokens.
- **GroqPlanner** — same, on Groq's free Llama models (OpenAI-compatible, no SDK). Weaker models emit rougher tool output, so the shared schema is permissive and a `normalizeSteps` pass repairs it (drops bogus navigates, coerces bad strategies, downgrades an unbacked `valueEquals`).

Selection is automatic: `GROQ_API_KEY` → Groq, else `ANTHROPIC_API_KEY` → Claude, else the
offline heuristic. Both LLM planners share one schema + prompt (`src/compiler/emit.ts`) so they
can't drift.

## Trust primitives

The reason an ops leader lets an agent touch a system of record:

- **Verification depth** — every step carries a post-condition that must hold. A write is verified
  by re-reading the saved record (`valueEquals`), so an agent is never told "success" when nothing
  happened.
- **Confirmation gates** — a `mutating` intent will not run its irreversible commit step without
  `confirm: true`. Unconfirmed, it returns `confirmation_required` with a description of the pending
  write and touches nothing in the system of record.
- **Audit log** — every verified action is appended to `skills-db/audit.log`: what intent, which
  params, the outcome, and exactly which post-conditions passed.
- **Failure taxonomy** — a failed run is classified `access_revoked` / `system_changed` /
  `skill_wrong` / `intent_impossible`, so an operator knows whether the system changed or the skill did.
- **Credential seam** — login steps reference secrets as `{secret:key}`, resolved from a
  `CredentialSource` only at replay. Secrets never enter the skill cache or the audit log. A real
  vault is just another `CredentialSource`.

## Quickstart

```bash
npm install
npx playwright install chromium
npm run demo
```

The demo boots a local **owned** system (an "internal CRM" fixture), shows the confirmation gate
blocking an unconfirmed write, then runs one intent N times and prints the amortization curve:
run 1 compiles, runs 2..N replay free.

```
│ run │ path   │  ok  │ planner tok  │
│   1 │ cold   │ yes  │        1033* │
│   2 │ warm   │ yes  │            0 │
│   3 │ warm   │ yes  │            0 │
```

### Commands

```bash
npm test                       # unit suite
npm run typecheck
npm run demo                   # cold→warm token amortization on the owned system
npm run mcp                    # MCP server (stdio) — boots the fixture, serves internal-crm
npx tsx src/cli/selfheal.ts    # proves in-place drift recovery
```

### Demo flags

```
--intent NAME      list_tickets | create_ticket   (default: create_ticket)
--param k=v        intent params, repeatable       (e.g. --param subject="Reset password")
--runs N           number of runs                  (default: 5)
--headed           show the browser
--keep             keep the cached skill (skip the cold run)
```

## MCP tools

Per system, uniform:

- `list_intents` — discover the verified intents this system exposes.
- `execute_intent` — run any intent by name: `{ intent, params, confirm? }`.
- one generated tool per intent (`list_tickets`, `create_ticket`, …) with typed params.

Every call returns `status` (`ok` / `confirmation_required` / `failed`), `path` (`cold`/`warm`),
`plannerTokens`, `failure` (when failed), `pendingConfirmation` (when gated), and structured `data`.

## Status

MVP. The mechanism is proven end-to-end on an owned-system fixture: cold→warm at 0 warm tokens,
per-step verification, confirmation-gated writes, self-heal recovering a broken locator in place,
and a real MCP call completing a real flow. Adding a system = adding a `SystemDefinition`.

**Safety:** never submits payment, never stores credentials, confirmation gates on irreversible
actions.

**Known limits / next:** authenticated sessions are demonstrated via a local credential seam — a
production vault integration, verified-agent identity (Web Bot Auth) for licensed third-party
portals, and a measured drift rate on a real design-partner system are the next milestones. Non-web
legacy (Citrix, green-screen) is explicitly out of scope.

See `CLAUDE.md` for development guidelines and `CONCEPT.md` for the thesis.
