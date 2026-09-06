# DriftPilot (local MVP scaffold)

DriftPilot is a GitHub App concept that watches third-party API/SDK changelogs,
detects breaking changes relevant to *your* codebase, and has an AI agent open
a migration pull request — not just an alert.

This repo is a **local, offline scaffold** that proves the core loop end to
end, with no GitHub App, webhooks, hosting, or live changelog scraping:

> detect deprecated usage → codemod it to the new API → produce a local
> git branch + commit + PR description

See [`plan.md`](./plan.md) for the full scope and what's explicitly deferred.

## What's included

- A **changelog fixture** (`fixtures/changelogs/stripe-2025-06-30.json`)
  describing a real-shaped breaking change: Stripe's `charges.create` being
  deprecated in favor of `paymentIntents.create`.
- A **sample "customer" repo** (`sample-repo/`) that calls the deprecated API.
- A **CLI** (`driftpilot scan`, `driftpilot fix`) that:
  - `scan` — uses `ts-morph` to AST-match deprecated call sites and prints
    file/line/snippet.
  - `fix` — copies `sample-repo` into a scratch temp directory (the checked-in
    fixture is never mutated), runs the codemod, creates a branch, commits the
    change, and writes `PR_DESCRIPTION.md` — the local stand-in for "opened a
    PR". Prints the branch name, commit hashes, and diff to the terminal.
- An **AI-agent-drafted PR description**: if `ANTHROPIC_API_KEY` is set,
  DriftPilot asks Claude to write the PR title/body from the changelog entry
  and diff. Without a key, it falls back to a deterministic template — the
  demo never depends on network access.

## Requirements

- Node.js 18+
- `git` on your `PATH`

## Quickstart

```bash
npm install

npm run scan   # prints the detected deprecated usage in sample-repo/src/checkout.ts
npm run fix    # produces a branch + commit in a scratch copy, prints the diff + PR_DESCRIPTION.md path
```

> If your shell has `NODE_ENV=production` set, plain `npm install` will
> silently skip devDependencies (`tsx`, `vitest`, `typescript`), and the
> commands above will fail with "command not found". Run
> `NODE_ENV=development npm install` (or `unset NODE_ENV`) instead.

Optional — get an AI-authored PR description instead of the template:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm run fix
```

### Running against a different repo/changelog

```bash
npx tsx src/cli.ts scan --repo <path> --changelog <path-to-changelog.json>
npx tsx src/cli.ts fix  --repo <path> --changelog <path-to-changelog.json>
```

## Tests

```bash
npm test
```

- `tests/detector.test.ts` — the detector finds exactly one deprecated call
  site in the sample repo.
- `tests/codemod.test.ts` — the codemod rewrites `stripe.charges.create(...)`
  to `stripe.paymentIntents.create(...)` with the field remapping applied.

## Success criteria to eyeball

1. `npm run scan` reports the exact line in `sample-repo/src/checkout.ts`
   using `stripe.charges.create`.
2. `npm run fix` results in a scratch repo where `git log` shows a new commit
   on a new branch, the diff shows the call site rewritten to
   `stripe.paymentIntents.create` with `source` renamed to `payment_method`
   and `confirm: true` added, and `PR_DESCRIPTION.md` exists and cites the
   changelog entry.
3. Re-running `npm run fix` is idempotent — it always starts from a fresh
   copy in a new temp directory and never mutates the checked-in
   `sample-repo/`.

## Layout

```
src/
├── cli.ts                       # `scan` and `fix` subcommands
├── changelog/                   # BreakingChange schema + fixture loader
├── detector/scanUsage.ts        # ts-morph: find call sites matching a BreakingChange
├── fixer/
│   ├── codemods/                # one AST transform per breaking change
│   └── applyFix.ts              # detect -> codemod -> write files
├── agent/generatePrDescription.ts  # Claude call w/ template fallback
└── git/localPr.ts               # copy repo to tmp, branch, commit, write PR_DESCRIPTION.md

fixtures/changelogs/             # sample breaking-change entries
sample-repo/                     # tiny fixture "customer" project using the old API
tests/                           # vitest unit tests
```
