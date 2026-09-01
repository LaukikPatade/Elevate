# Elevate — Tasks & Roadmap

Backlog for taking Elevate from a proven MVP to a production system. Ordered by tier:
**Tier 0** = don't corrupt real data · **Tier 1** = survive real systems · **Tier 2** = auto-coverage ·
**Tier 3** = scale & data · **Business** = the non-code go/no-go gates.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done

---

## ✅ Recently done (context)
- [x] Core pipeline: perceive → compile → cache → replay → self-heal → MCP
- [x] Three planners behind one `Planner` seam (heuristic / Claude / Groq)
- [x] Trust primitives: confirmation gate, audit log, failure taxonomy, credential seam
- [x] Groq planner repaired — JSON mode on `gpt-oss-120b` (survives model churn)
- [x] Fixed 17s verify-read hang (`innerText`/`inputValue` blocking on missing selector)
- [x] Richer multi-view CRM fixture (5 intents) + shape-deduped fingerprint
- [x] **Proven on a live production system** — OrangeHRM demo (real login + read)
- [x] Hardened `perceive` for SPA async redirects (`networkidle` + retry)

---

## 🔴 Tier 0 — Safety before any real write
- [x] **Idempotency for writes** — a mutating intent can declare an `idempotency` existence check (a `Verify`); the orchestrator runs it before the commit and returns `already_done` (no write) if the record is already present. Natural-key dedup against the system of record itself.
  → `policy/idempotency.ts`, `systems/definition.ts` (`idempotency`), `runtime/execute.ts` (`verifyHolds`), `orchestrator.ts`, `types.ts` (`already_done`)
- [x] **Dry-run mode** — already provided by the confirmation gate: call a mutating intent without `confirm` → it runs the read-only prefix, returns `confirmation_required` + `pendingConfirmation`, and writes nothing. (No separate flag needed.)
- [ ] **Rollback / compensating actions** — record how to undo reversible intents; hard-gate the irreversible ones.
  → `policy/`, `audit/log.ts`
- [ ] **Prompt-injection defense** — page text is untrusted input that can hijack the planner. Neutralize instruction-like content in the snapshot; red-team a skill before it goes live.
  → `runtime/perceive.ts` (sanitize), new `policy/guardrails.ts`

## 🟠 Tier 1 — Robustness on real systems
- [ ] **Perception without testids** — enrich the snapshot with the accessibility tree (and optionally a visual pass) so locators aren't testid-dependent.
  → `runtime/perceive.ts`, `types.ts` (`SemanticNode`)
- [ ] **Extraction quality** — `.oxd-table-card` innerText mashes cells (`"EMP11903B Auto27639…"`). Extract per-cell/structured rows instead of joined text.
  → `runtime/execute.ts` (extract action), maybe `types.ts`
- [ ] **Timing / async** — replace fixed timeouts with wait-for-network-idle, spinner detection, retry-with-backoff. (Partly started: `perceive` networkidle, locator 5s.)
  → `runtime/execute.ts`, `runtime/locator.ts`, `runtime/browser.ts`
- [ ] **Verification grounding** — derive the `valueEquals` read-back locator from the actual DOM instead of letting the model guess it; confirm the verify target resolves at compile time.
  → `runtime/execute.ts`, `compiler/emit.ts`
- [ ] **Real auth / session manager** — SSO/SAML, MFA/OTP, session-expiry detection + refresh mid-run. Turn the static login recipe into a session manager.
  → `auth/credentials.ts` + new `auth/session.ts`, `orchestrator.ts`

## 🟡 Tier 2 — Coverage (auto, not hand-written)
- [ ] **Interactive multi-step compiler** — compile by *driving* the flow (click → observe → record) so behind-a-click views (resolve/assign today) become cold-compilable.
  → new `compiler/explore.ts` implementing the existing `Planner` interface — no caller changes
- [ ] **Model gateway** — never hardcode a model again (Groq retired one on us). Route through OpenRouter/LiteLLM with fallbacks.
  → `compiler/groq.ts` + `compiler/llm.ts` behind a small gateway
- [ ] **Discovery / cartographer agent** — crawl a system and propose its intent catalog instead of hand-authoring.
  → new `compiler/discover.ts`, `systems/definition.ts`

## 🟢 Tier 3 — Scale & data
- [ ] **Durable store (Postgres)** — replace `JsonSkillStore` (full-file rewrite, not concurrency-safe) with Postgres behind the existing `SkillStore` interface. Same for `AuditLog`.
  → new impls in `skills/store.ts`, `audit/log.ts` — zero caller changes
- [ ] **Retrieval — software-family templates** — reuse one company's compiled skill as a template for the next instance of the same software. Needs vectors + nearest-neighbor search (**pgvector**).
  → depends on Postgres task
- [ ] **Embeddings pipeline** — canonicalize the semantic snapshot (structure only, data stripped) → small text-embedding model → vector stored with the skill. One perception, two artifacts: fingerprint hash (exact) + embedding (similar).
  → `runtime/perceive.ts` (canonicalize), new `compiler/embed.ts`
- [ ] **Browser infra at scale** — thousands of concurrent authed sessions (Browserbase).
  → make `runtime/browser.ts` an interface, add a remote impl
- [ ] **Fleet drift monitor** — scheduled canary that probes cached skills, classifies drift via the failure taxonomy, auto-heals or escalates, and **measures `heal_rate`** per system.
  → new service reading `skills/store.ts`, writing `audit/log.ts`
- [ ] **Observability + regression evals** — trace every cold compile/heal (Langfuse); a skill test-suite catching breakage on model/site changes.
  → hooks in `orchestrator.ts`, new `eval/`

## 🔵 Quick wins / dev-experience
- [ ] **Wire OrangeHRM into the demo CLI** — `npm run demo -- --system orangehrm` (currently only `internal-crm`).
  → `src/cli/demo.ts`
- [ ] **Expose multiple systems via MCP** — server currently hardwires `internal-crm`.
  → `src/mcp/server.ts`

---

## 🟣 Business gates (not code — the actual go/no-go)
- [ ] **One committed design partner** — someone whose job is clicking an internal/vendor web app daily.
- [ ] **Their real system end-to-end** — compile Elevate skills against the partner's actual system.
- [ ] **Measured drift rate** — instrument a real internal system 4–6 weeks. The load-bearing economic assumption.
- [ ] **Head-to-head** vs cached Stagehand / Skyvern on cost per verified action.
- [ ] **Pricing test** — per connected system per month vs per verified action.

---

## 🎯 Critical path (if only three)
1. **Idempotency + dry-run** (Tier 0) — don't corrupt real data.
2. **Real auth / session manager** (Tier 1) — everything is behind a login.
3. **Interactive multi-step compiler** (Tier 2) — kills the recipe bottleneck and the behind-a-click limit.

> Most of these slot into seams that already exist — `Planner`, `SkillStore`, `AuditLog`, `CredentialSource`, and the browser session. The scaffold isn't throwaway; it's the interfaces the production pieces plug into.
