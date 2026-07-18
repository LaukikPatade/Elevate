# Elevate — Concept Document

*Status: MVP built and verified. Direction revised July 2026 after external market validation.
Claims are labelled **[proven]** (we ran it), **[reasoned]** (argued from first principles, not yet
measured), **[researched]** (externally sourced, July 2026 — see Appendix), or **[unvalidated]**
(needs research or a design partner).*

---

## 1. The gap

### What we originally believed

v1 of this document argued that browser automation re-reasons every run, that the reasoning is
repeated/identical/discarded, and that this was "a missing cache nobody is naming."

**That gap closed while we were building.** Compile-once → cache → deterministic replay →
self-heal is now the converged architecture of the category: Stagehand ships automatic action
caching with LLM re-heal, Skyvern ships Code Caching (agent learns a flow once, generates
deterministic Playwright code, falls back to the agent on drift), Google's Project Mariner ships
Teach & Repeat, Anchor Browser is built on record-and-replay, browser-use persists reusable skill
functions. **[researched]** Our mechanism was the right call — the market proved it by adopting
it — but it is table stakes, not a company.

### The gap that actually remains

Two facts survived contact with the market:

1. **All of that caching is private and developer-facing.** Stagehand and Skyvern sell SDKs to
   developers who build and own their automations. Nobody serves compiled, verified site actions
   *to agents, as an interface*. No cross-customer skill layer exists. **[researched]**

2. **The head of the market is getting machine interfaces; the long tail never will.** Shopify's
   MCP endpoint went self-serve in June 2026; ACP/AP2/UCP are rails for consumer commerce; WebMCP
   is in Chrome origin trial. But none of that reaches the software that runs the real economy:
   vendor portals, decade-old internal CRMs, hospital and logistics and government systems whose
   vendor is dead, acquired, or indifferent. That software will *never* ship an MCP. **[researched]**

> **The gap: agents need machine-readable interfaces; the long tail of legacy and internal web
> software will never get one from its vendor. Nobody is compiling those interfaces on the
> software owner's behalf.**

---

## 2. Our proposal

### One line

**Point Elevate at any legacy or internal web app you already own or license, and get a verified,
self-healing MCP server for it — no vendor cooperation, because the vendor is gone.**

The direction change from v1: same compiler, different target. Not the open consumer web
(contested, legally hostile, economically eaten) — the customer's *own* systems, where
authorization is solved by definition and drift is structurally low.

### The core move

Treat a web action as a **compilable, cacheable, verifiable asset** rather than a reasoning task.

- **Cold path (once per system):** perceive the page → a planner reasons out the action → emit a
  *parameterized, deterministic skill* → verify it works → cache it.
- **Warm path (forever after):** look up the skill → bind params → replay deterministically.
  **Zero planner tokens.** **[proven]**
- **Drift:** when a locator breaks, re-locate *that one element* and patch the skill in place —
  not a full recompile. **[proven]**

### Architecture

| Layer | Responsibility | Why it matters |
| --- | --- | --- |
| **Perceive** | Page → compact semantic snapshot (ARIA roles, accessible names, testids) + a structural fingerprint | Not screenshots, not raw HTML. Cheapest signal that still supports planning. |
| **Compile & cache** | Snapshot + intent → Skill, keyed by `(system, intent, fingerprint)` | The fingerprint is both the cache key *and* the drift detector. |
| **Replay & heal** | Deterministic execution with per-step verification and semantic self-heal | Determinism is the cost saving; verification is the trust; healing is the durability. |
| **Expose** | One MCP server per customer system; uniform tools across every system | The agent asks for an outcome, never touches HTML. |

### The Skill — the artifact that makes this work

A skill is an ordered list of steps. Each step carries:
- an **action** (`navigate` / `type` / `click` / `select` / `waitFor` / `extract`)
- a **robust target** — a primary locator plus ordered fallbacks
- a **value** — literal or `{param}`, bound at replay
- a **verify** — a post-condition that must hold (e.g. *the record actually saved*)

The `verify` field is doing more work than it looks. It's what stops an agent being told
"success" when nothing happened — the single most dangerous failure mode in agentic operation of
business systems, where a silently-dropped update corrupts real records. Every observation we
return is checked, not assumed. **[proven]** In this market, verification is not a feature — it's
the reason an ops leader lets an agent touch their system of record at all.

### The economics — corrected

v1's formula missed the dominant term. The real cost per run is:

```
amortized cost per run ≈ (cold_cost / N) + (heal_rate × heal_cost) + browser_run_cost
```

The third term is a hard floor — Skyvern's own published caching numbers ($0.11 → $0.04/run,
279s → 120s) show cached replay lands at 2–3× cheaper, not →0, because browser time dominates.
**[researched]** Two consequences:

1. The benchmark to beat is **cached Stagehand / Skyvern Code Caching**, not "no cache."
   The metric is **cost per successful verified action, head-to-head.**
2. The `heal_rate` term decides viability — and it is exactly where this market is favorable:
   **internal and legacy systems drift rarely.** That claim is load-bearing and must be measured
   at a design partner, but it is the structural reason this vertical works where the open web
   didn't. **[reasoned → measure in Phase 1]**

### Positioning

| Against | What they are | Why we're different |
| --- | --- | --- |
| **Stagehand / Skyvern / browser-use** | SDKs for developers who build and own automations; caching is private per-customer | We serve the *finished interface to the agent* — compile, verify, host, heal. The customer never writes automation code. |
| **UiPath / RPA** | Owns the legacy-app pain; Healing Agent + ScreenPlay ship self-healing UI automation | Six-figure enterprise sales, RPA-workflow output. An agent can't discover and call a UiPath workflow the way it calls an MCP tool. We're self-serve, developer-first, agent-native. |
| **Vendor MCPs / WebMCP / commerce rails** | The head of the market building its own machine interfaces | We cover the software whose vendor will never do this. Their growth doesn't shrink our market — dead vendors don't adopt standards. |
| **AgentLayer and similar** | Early indie entrants auto-generating MCP tools from crawls | Validation that the wedge is real. The race is to verification depth and a paying design partner, not to the idea. |

### Legal posture — explicit, not implied

- We operate on **systems the customer owns or is licensed to use**. This dissolves the
  authorization question that produced the *Amazon v. Perplexity* injunction (user permission ≠
  site authorization). **[researched]**
- We **never** enter logged-in areas of third-party consumer sites. That is the exact fact
  pattern that lost in court.
- Where a customer points us at a third-party vendor portal, we act as a **verified agent**
  (Web Bot Auth / signed-agent identity) under the customer's own credentials and license.
- Never let a skill submit payment or store user credentials outside the customer's own vault
  integration. Confirmation gates on irreversible actions.

### The moat — rewritten honestly

v1 claimed a compounding shared skill library "an incumbent can't clone." That was backwards:
network effects favor whoever has traffic, and Browserbase has the traffic. Worse, in this
market cross-customer skill sharing is an *anti-feature* — no enterprise wants its internal
workflows in a shared registry. **[researched/reasoned]**

Early defensibility is a product bet, not a flywheel:

1. **Verification depth** — per-step post-conditions on systems of record is the trust product;
   competitors treat it as an afterthought.
2. **Agent-native distribution** — being the MCP the customer's agents already call makes every
   additional connected system near-zero marginal integration.
3. **Skill templates per software family** (the same ancient portal software runs at hundreds of
   companies) — compounding *within* our customer base without cross-customer data sharing.

A shared public registry remains a later option, contingent on legal clarity and on having
traffic worth sharing. It is no longer the thesis.

---

## 3. Our execution plan

### Phase 0 — Prove the mechanism ✅ **DONE**

Built and verified end-to-end on one site (saucedemo.com — now a test fixture, not evidence):

- Perception → semantic snapshot + structural fingerprint
- Pluggable planner (`Planner` interface): `HeuristicPlanner` (offline) and `LlmPlanner` (Claude)
- Skill DSL, JSON-backed cache behind a `SkillStore` interface
- Deterministic executor with fallback locators + per-step verification
- Semantic self-heal
- MCP server with uniform intent tools
- 14 unit tests, typecheck clean

**Measured results [proven]:** cold run compiles (~1,142 tok), warm runs replay at 0 tok;
self-heal recovered a deliberately broken locator in place; real MCP `tools/call` end-to-end.

**The mechanism works.** What's unproven is a real customer system and a paying customer.

### Phase 1 — Prove the wedge *(the make-or-break phase, ~30 days before more code)*

1. **Design partner hunt** — talk to 5–10 people whose job includes clicking through an internal
   or vendor web app daily (ops at insurers, clinics, logistics brokers, property managers).
   Learn the workflow and what a month of that labor costs. *Gate: one design partner committed.*
2. **One real system end-to-end** — compile Elevate skills against the partner's actual system;
   real intents, real login, real data. *Gate: partner's agent (or ours on their behalf) completes
   their workflow through our MCP.*
3. **Drift measurement where it matters** — instrument the partner system for 4–6 weeks.
   *Gate: measured heal_rate on an internal system. Expectation: near zero. If it isn't, the
   thesis is wrong here too.*
4. **Head-to-head benchmark** — same workflow via cached Stagehand and Skyvern Code Caching.
   *Gate: we win on cost per successful verified action, or we can state precisely why the
   agent-native interface is worth the difference.*
5. **Pricing test** — per verified action vs. per connected system per month. *Expectation:
   buyers think per-system.* **[unvalidated]**

### Phase 2 — Productionize for the enterprise

- Authenticated sessions as a first-class capability (internal systems are all behind login) —
  credential vault integration, never credential storage
- Confirmation gates for irreversible actions; audit log of every verified action
- Failure taxonomy: *system changed* / *access revoked* / *skill wrong* / *intent impossible*
- Verified-agent identity (Web Bot Auth) for licensed third-party vendor portals

### Phase 3 — Compound within the customer base

- More systems per customer (the second system should cost minutes, not days)
- Software-family templates: one customer's ancient-portal skill bootstraps the next customer on
  the same software, without sharing customer data
- Verification as a product surface: dashboards of what agents did, proven

### Phase 4 — Optional re-expansion

- The open web as a verified agent, if and when the legal landscape settles
- A shared registry, if and when we have traffic worth sharing and a trust design (provenance,
  poisoning resistance, strict separation of skill structure from user params)

---

## 4. Possible problems

Ordered by how likely they are to kill the idea.

### 4.1 The drift assumption is load-bearing and unmeasured

The entire economic case rests on "internal systems drift rarely." It's structurally plausible
(no growth team A/B-testing an insurance portal from 2012) but unmeasured. Phase 1 §3 is the
go/no-go. **[reasoned]**

### 4.2 UiPath moves down-market or agent-native

The incumbent owns the pain, the relationships, and now ships self-healing UI automation. If
UiPath exposes workflows as MCP tools with self-serve onboarding, our wedge narrows to speed and
developer experience. Bet: their enterprise sales DNA makes that pivot slow. It's still a bet on
incumbent slowness — v1's honesty about that carries over. **[researched/reasoned]**

### 4.3 The sales motion is the actual risk

This pivots us from "internet-scale infrastructure" to selling software to unglamorous
businesses: slower, relationship-driven, one design partner at a time. The mechanism being good
does not find the insurer's ops manager. Founder time shifts from code to customer discovery, and
that is the correct allocation for the next 30 days. **[reasoned]**

### 4.4 Credentials and blast radius

Internal systems mean logged-in sessions on systems of record. A wrong click writes to real
business data. Per-step verify and confirmation gates are the containment **[proven at MVP
scale]**, but credential handling, audit, and rollback stories must be enterprise-grade before
any customer trusts us with more than a sandbox. This moves from "Phase 2 someday" to core
product.

### 4.5 Silent success

A skill that reports success while achieving nothing — or something else — is worse than a crash
on a system of record. Verification is designed for this; verifies are only as good as the chosen
post-condition. Unchanged from v1, and more consequential in this market, in both directions:
worst failure mode, strongest selling point.

### 4.6 Some legacy is not web

Citrix, desktop Java, green-screen terminals. Out of scope; we say so explicitly rather than
diluting into general RPA. The web-based slice of legacy is large enough. **[unvalidated — size it]**

### 4.7 The story got smaller

v1 promised a compounding network-effect moat. v2 promises a good product in a real market with
paying customers, and a *path back* to the bigger story (Phase 4) from a position of revenue.
The reverse path — internet-scale first, revenue later — is the one the market evidence closed.
We should be honest that some investors will want the bigger story on day one.

---

## 5. Market and product need

### Why now

1. **Agents got good enough to act**, and enterprises are actively adopting them — but deployment
   at scale is bottlenecked on infrastructure, and the systems agents most need to touch have no
   machine interface. **[researched]**
2. **The head of the market is solving this for itself** (vendor MCPs, WebMCP, commerce rails),
   which trains buyers to expect agent access — and makes its absence on legacy systems a felt,
   named pain rather than background noise. **[reasoned]**
3. **Agent identity infrastructure matured** (Web Bot Auth, signed agents, IETF WG) — a
   legitimate, verified way to operate exists now. Zero-cooperation stealth automation is being
   squeezed out technically and legally; we're built for the world that's replacing it. **[researched]**

### Who wants this

| Buyer | Pain | Why Elevate |
| --- | --- | --- |
| **Ops teams on legacy/vendor systems** (insurers, clinics, logistics, property mgmt) | Humans paid to click through portals daily; no API, none coming | Their agents operate the system through one verified MCP |
| **Enterprises deploying internal agents** | Agents can reach modern SaaS via MCP, but not the systems of record that matter | We're the missing coverage, on software they already own |
| **Agent platforms / consultancies** | Every deployment stalls on "the client's legacy system" | Integrate one MCP, unlock the engagement |

### What "Software for Agents" means here

YC's RFS: agents need machine-readable interfaces instead of forms, buttons, and dashboards. The
head of software will ship those itself. **Elevate is the compiler that gives the rest of
software a machine interface — the software whose vendor never will.** That is the
picks-and-shovels position stated precisely, not aspirationally.

### Business model sketch **[unvalidated]**

Primary: per connected system per month — matches how this buyer already budgets (it replaces
a labor line-item). Secondary experiment: per successful verified action, which aligns us with
outcomes but makes us eat drift risk; viable only where measured heal_rate is near zero.

### To validate before betting further

- Measured drift/heal rate on a real internal system (Phase 1 §3 — the go/no-go)
- One design partner who will pay (Phase 1 §1 — the other go/no-go)
- Head-to-head vs. cached Stagehand/Skyvern on cost per verified action
- Size of the web-based-legacy slice vs. desktop/Citrix legacy
- Whether buyers accept per-system pricing at a point that clears our browser-infra floor

---

## 6. Summary

**The gap.** Compile-and-cache browser automation is now table stakes — the market adopted our v1
mechanism while we built it. What nobody serves is the *finished interface*: verified,
self-healing, agent-callable access to the long tail of legacy and internal web software whose
vendors will never ship an MCP.

**Our proposal.** Point Elevate at a system you already own or license; it compiles the system's
actions **once** into deterministic, per-step-verified, parameterized skills; replays them at
zero planner tokens; heals on drift; and exposes the whole system as **one MCP server** your
agents call. Authorization is solved by definition — it's your software.

**Status.** The mechanism is **built and proven** end-to-end: cold→warm at 0 warm tokens,
self-heal recovering a deliberately broken skill, a real MCP call completing a real flow. What's
unproven is a real customer system, a real drift rate, and a real invoice.

**Execution.** Phase 1 is make-or-break and mostly not code: a committed design partner, their
actual system end-to-end, 4–6 weeks of drift measurement, a head-to-head against cached
Stagehand/Skyvern, and a pricing answer.

**The honest risks.** The drift assumption is load-bearing and unmeasured (§4.1). UiPath owns
the pain and could go agent-native (§4.2). The sales motion, not the code, is the hard part now
(§4.3). And the story is smaller than v1's — deliberately, with a path back (§4.7).

**The questions that decide this:**

> **Why does a customer pick Elevate over cached Stagehand or UiPath — and will they pay for an
> auto-generated MCP on software they already own?**
>
> **And does the internal web really drift as rarely as we're betting it does?**
>
> The first is answered by a design partner. The second by six weeks of measurement. Both gates
> sit in Phase 1, before further investment.

Everything else is engineering. **Those two answers are the business.** Get them first.

---

## Appendix — key market evidence (July 2026)

- Caching is table stakes: [Stagehand caching](https://www.browserbase.com/blog/stagehand-caching),
  [Skyvern Code Caching](https://www.skyvern.com/docs/developers/features/code-caching),
  [Field guide to browser harnesses 2026](https://theairuntime.com/p/the-complete-field-guide-to-browser)
- Cached replay economics (2–3×, not →0): Skyvern published $0.11→$0.04/run, 279s→120s
- Legal: [Amazon wins injunction against Perplexity's shopping agent, March 2026](https://www.cnbc.com/2026/03/10/amazon-wins-court-order-to-block-perplexitys-ai-shopping-agent.html) —
  user permission ≠ site authorization (CFAA); appeal argued June 2026
- Verified agent identity: [Cloudflare signed agents / Web Bot Auth](https://blog.cloudflare.com/signed-agents/),
  IETF WG chartered 2026
- E-commerce middle band collapsed: Shopify public MCP self-serve since June 2026; ACP / AP2 / UCP rails
- WebMCP: Chrome origin trial (149–156); mainstream agents not yet calling it on arbitrary sites
- Incumbent motion: [UiPath Healing Agent + ScreenPlay](https://www.uipath.com/platform/agentic-automation/rpa/ui-automation)
- Early direct entrant: [AgentLayer](https://dev.to/farhanrhine/how-i-turned-any-website-into-an-mcp-server-and-what-i-learned-building-it-1jpm)
- YC RFS: [Software for Agents](https://www.ycombinator.com/rfs)
