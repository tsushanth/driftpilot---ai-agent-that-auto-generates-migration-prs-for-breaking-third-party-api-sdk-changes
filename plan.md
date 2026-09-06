# DriftPilot — Local MVP Scaffold Plan

## Goal of this MVP

Prove the core value end-to-end, entirely on disk, with no external services:

> Given (a) a codebase that calls a third-party SDK, and (b) a description of a
> breaking/deprecating change in that SDK, DriftPilot detects the affected call
> sites, rewrites them to the new API surface, and produces a local git branch +
> commit + PR description — i.e. a "PR" artifact, without actually touching GitHub.

Everything else about the real product (watching live changelogs, GitHub App
install, webhooks, opening a real PR via the GitHub API, billing, multi-tenant
hosting) is explicitly deferred. This scaffold answers one question: **can the
detect → codemod → "PR" pipeline actually work on a real code sample?**

## Stack

- **Node.js + TypeScript**, run via `tsx`/`ts-node` — no build step needed for the demo.
- **Commander** for the CLI (`driftpilot scan`, `driftpilot fix`).
- **ts-morph** for AST-aware detection and codemodding of the sample TypeScript/JS repo (regex alone is too fragile to demonstrate "real" migration; ts-morph is still a single dependency, no framework).
- **simple-git** (or raw `child_process` + `git` CLI) to create a branch/commit in a scratch copy of the sample repo — this stands in for "opening a PR."
- **vitest** for unit tests.
- Optional, guarded by `ANTHROPIC_API_KEY`: a single call to Claude to draft the PR title/body in natural language, citing the changelog entry and changed files. If no key is set, fall back to a deterministic templated PR description. This keeps the "AI agent" framing honest without making the demo depend on network access or a paid key.

No web framework, no database, no queue, no Docker — a single CLI package.

## Explicitly out of scope for this MVP

- GitHub App, GitHub API calls, webhooks, PR creation on a real repo
- Auth, accounts, multi-tenant anything
- Billing
- Hosting/deployment of any kind
- Live scraping/polling of real changelogs (Stripe/OpenAI/AWS/etc.) — a local JSON fixture stands in for "the changelog we detected a breaking change in"
- Support for multiple SDKs/languages — one demo SDK (Stripe Node SDK) and one breaking change is enough to prove the loop closes
- Running the generated fix's tests / CI — "tested pull request" is simulated by including before/after code + a note in the PR description, not by wiring up a real test runner against the SDK

## File/directory layout

```
driftpilot/
├── plan.md                          # this file
├── README.md                        # quickstart / demo script
├── package.json
├── tsconfig.json
├── src/
│   ├── cli.ts                       # `scan` and `fix` subcommands
│   ├── changelog/
│   │   ├── types.ts                 # BreakingChange schema (sdk, id, detectPattern, migrationNote)
│   │   └── loader.ts                # loads a changelog fixture JSON from disk
│   ├── detector/
│   │   └── scanUsage.ts             # ts-morph: find call sites matching a BreakingChange's pattern
│   ├── fixer/
│   │   ├── codemods/
│   │   │   └── stripe-charges-to-payment-intents.ts   # one concrete AST transform
│   │   └── applyFix.ts              # orchestrates detect -> codemod -> write files
│   ├── agent/
│   │   └── generatePrDescription.ts # Claude call w/ template fallback
│   └── git/
│       └── localPr.ts               # copy repo to tmp, branch, commit, write PR_DESCRIPTION.md
├── fixtures/
│   └── changelogs/
│       └── stripe-2025-06-30.json   # sample breaking-change entry
├── sample-repo/                     # tiny fixture "customer" project using the old API
│   ├── package.json
│   └── src/checkout.ts              # uses stripe.charges.create(...)
└── tests/
    ├── detector.test.ts
    └── codemod.test.ts
```

## How it demonstrates the core loop

1. `fixtures/changelogs/stripe-2025-06-30.json` describes: SDK `stripe`, deprecated call `stripe.charges.create`, replacement `stripe.paymentIntents.create` + required field remapping, sunset date.
2. `driftpilot scan --repo sample-repo --changelog fixtures/changelogs/stripe-2025-06-30.json` uses ts-morph to find matching call sites in `sample-repo/src/checkout.ts` and prints file/line/snippet.
3. `driftpilot fix --repo sample-repo --changelog fixtures/changelogs/stripe-2025-06-30.json` copies `sample-repo` to a scratch temp dir, runs the matching codemod to rewrite the call site, creates a branch named `driftpilot/migrate-stripe-charges-to-payment-intents`, commits the change, and writes `PR_DESCRIPTION.md` (title, body, before/after diff, changelog citation, sunset date) into the scratch dir.
4. Output printed to the terminal includes the branch name, commit hash, and a `git diff` — the local stand-in for "opened PR #123."

## Verification

- **Unit tests** (`npm test`, vitest):
  - `detector.test.ts`: given the fixture changelog + `sample-repo/src/checkout.ts`, `scanUsage` returns exactly one match at the correct file/line.
  - `codemod.test.ts`: given a small source string using `stripe.charges.create(...)`, the codemod produces the expected `stripe.paymentIntents.create(...)` output (string/snapshot comparison).
- **Manual end-to-end run-through**:
  ```
  npm install
  npm run scan   # prints detected deprecated usage in sample-repo
  npm run fix    # produces a branch+commit in a scratch copy, prints diff + PR_DESCRIPTION.md path
  ```
  Success criteria to eyeball:
  - `npm run scan` reports the exact line in `sample-repo/src/checkout.ts` using `stripe.charges.create`.
  - `npm run fix` results in a scratch repo where `git log` shows a new commit on a new branch, `git diff <base>..HEAD` shows the call site rewritten to `stripe.paymentIntents.create` with correctly remapped fields, and `PR_DESCRIPTION.md` exists and references the changelog entry.
  - Re-running `npm run fix` is idempotent (operates on a fresh copy each time; doesn't mutate the checked-in `sample-repo/`).
