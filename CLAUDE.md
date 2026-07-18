# Elevate — Development Guidelines

## What this project is

Elevate compiles a website's actions into reusable, deterministic skills so agents can act on
any site without re-reasoning the DOM every run. Cold path: perceive → plan → compile → cache.
Warm path: replay the cached skill at ~zero planner tokens. Skills self-heal on drift.

## Code style

**No extra comments.** Code must explain itself through naming and structure.

- Do not write comments that restate what the code does (`// loop over items`).
- Do not write comments that narrate history, decisions, or justify a change to a reviewer.
- Do not write JSDoc/banner blocks on every file, class, or function by default.
- Write a comment **only** to state a constraint the code cannot express: a non-obvious external
  quirk, a workaround for a third-party bug, a protocol requirement. If a comment is warranted,
  one line, stating the constraint — not the mechanics.
- If you feel the urge to comment to make code understandable, rename or extract instead.

**Naming carries the meaning.** Prefer an intention-revealing name over a comment. Functions are
verbs, values are nouns, booleans read as predicates.

## Structure

**Clean and modular.**

- One module, one responsibility. If a file needs "and" to describe it, split it.
- Depend on interfaces, not implementations. `Planner` and `SkillStore` are the seams — new
  planners/stores drop in without touching callers. Keep it that way.
- Keep functions small and single-purpose. Extract rather than nest.
- No speculative abstraction. Add a seam when a second implementation actually exists.
- Pure logic stays free of I/O so it can be tested without a browser or network.

## Testing

**Test-driven.** Write the failing test first, then the minimum code to pass it, then refactor.

**Tests must be mutually exclusive. No redundancy.**

- Each test asserts exactly **one** behavior.
- No two tests may cover the same behavior. If a behavior is already covered, do not assert it
  again from another angle, another layer, or another file.
- A test's name states the single behavior it locks: `fingerprint differs when structure differs`.
- Do not re-test a dependency's behavior through a caller. Test the unit that owns the behavior.
- No incidental assertions: do not tack on extra `assert`s unrelated to the test's stated behavior.
- Prefer fast, deterministic unit tests over browser-driven ones. Browser flows are proven by the
  CLI harnesses (`src/cli/demo.ts`, `src/cli/selfheal.ts`), not duplicated in the unit suite.

Before adding a test, ask: *does any existing test already fail if this breaks?* If yes, don't
add it.

## Commands

```
npm test          # unit suite (node:test)
npm run typecheck # tsc --noEmit
npm run demo      # cold→warm token amortization against a live store
npm run mcp       # MCP server (stdio)
npx tsx src/cli/selfheal.ts   # proves drift recovery
```

## Conventions

- TypeScript, ESM, `strict`. No `any` unless a third-party type forces it.
- Never commit or push unless asked.
- Never let a skill submit payment or store user credentials. Cart-and-below only.
