# Datasworn Community

Clean-history home for the core Datasworn runtime package and build tooling.

This repository publishes:

- `@datasworn-community/core`
- `@datasworn-community/build-tools`

The repository starts as a scaffold for Phase 1 of the Datasworn restructure.
Implementation files copied or adapted from upstream Datasworn must be recorded
in `PROVENANCE.md`.

## Developer guide

### Prerequisites

- [Bun](https://bun.sh) `>=1.3.0` (pinned via `.tool-versions`/`packageManager`
  — if you use `asdf` or `mise`, the repo's pin is picked up automatically)
- Node `>=24`, for tools that shell out to `node` (TypeScript's CLI, etc.)

This repo is Bun-based: all build/test/lint commands below run through
`bun run <script>`, not `npm run`.

### Repo layout

```
packages/
  core/                  @datasworn-community/core — runtime types, schema
                         artifacts, and ID helpers consumed by apps
  build-tools/
    src/                 @datasworn-community/build-tools — build-time logic
                         (rules-package-builder, validators, CLIs) that
                         consumes a published core
    schema-source/       TypeBox schema definitions (source of truth) and the
                         codegen scripts that turn them into core's JSON
                         schemas and Datasworn.ts/DataswornSource.ts. Ported
                         from upstream; excluded from this repo's lint/typecheck
                         (see PROVENANCE.md)
scripts/                 Repo-internal scripts (not published): version
                         lockstep, package marker generation, CI guards
tests/                   Cross-package smoke tests (bun test)
.github/actions/
  publish-workspaces/    Repo-local npm workspace publisher and unit tests
```

### Getting started

```sh
bun install
bun run build      # compiles core (cjs+esm) and build-tools
bun run validate   # typecheck, lint, schema guards, tests — what CI runs
```

Run `bun run build` first whenever you pull new changes or switch branches:
several scripts (schema generation, the CI guards) import
`@datasworn-community/core` by package name, which resolves through the
workspace symlink to core's **built** `dist/`, not its `src/`.

### Common scripts

| Script | What it does |
| --- | --- |
| `bun run build` | Builds core (CJS + ESM) and build-tools via project-referenced `tsc -b` |
| `bun run check` | `tsc --noEmit` across `packages/*/src`, `scripts/`, and `tests/` |
| `bun run lint` | ESLint (schema-source is intentionally excluded — see below) |
| `bun run test` | `bun test` — unit/integration tests in `tests/` |
| `bun run test:publishing` | Unit tests for workspace dependency rewriting and publish guards |
| `bun run generate` | Regenerates core's JSON schemas + `Datasworn.ts`/`DataswornSource.ts` from `schema-source` (see next section) |
| `bun run check:schema-version` | Asserts the schema version is consistent across core, build-tools' peer pin, and the migration history folder |
| `bun run check:schema-generation` | Regenerates and asserts the result matches what's committed (catches "edited schema-source, forgot to run `generate`") |
| `bun run validate` | Everything CI runs: `check` + `lint` + both schema guards + application and publishing tests |

### Making a change

1. Branch from `main`.
2. If you're touching runtime behavior (`packages/core/src`,
   `packages/build-tools/src`), edit normally — `bun run check`/`lint`/`test`
   cover this code directly.
3. If you're touching the **schema** (`packages/build-tools/schema-source/schema/`)
   or bumping `DATASWORN_SCHEMA_VERSION` (`packages/core/src/DataswornVersion.ts`),
   see [Schema + type generation](#schema--type-generation) below — you must
   run `bun run generate` and commit its output.
4. Run `bun run validate` before opening a PR; it's the same gate CI runs.

### A note on `schema-source`

`packages/build-tools/schema-source/` is a near-verbatim port of upstream
Datasworn's schema/codegen pipeline (see `PROVENANCE.md` for exactly which
files and how they were adapted). It's deliberately excluded from this repo's
`tsc --noEmit` and `eslint` coverage — holding ported, vendored code to this
repo's stricter house style is a separate cleanup, not bundled into the
tickets that wire it up. It's still exercised for real: `bun run generate` and
`bun run check:schema-generation` both execute it directly, so a broken import
or runtime error there fails loudly even without typecheck/lint coverage.

### Schema + type generation

`packages/core/json/*.schema.json` and `packages/core/src/{Datasworn,DataswornSource}.ts`
are generated from the TypeBox schema source in
`packages/build-tools/schema-source/schema/` (plus `DataswornVersion.ts` for the
version). They're committed, not built on the fly — generation is a local,
dev-time step:

```sh
bun run build      # core must be built first; generation reads its exported version
bun run generate   # regenerates and overwrites the committed artifacts
```

Run `bun run generate` after editing schema-source or bumping
`DATASWORN_SCHEMA_VERSION`, then commit the result alongside your change.
`bun run validate` (and CI) includes `check:schema-generation`, which
regenerates into the same files and fails if anything differs from what's
committed — that's the signal you forgot to run `generate` before committing.

## Release Model

The build and release workflows live in this repository. They reuse only the
shared `bun-build@v1.3.0` action for Bun setup, dependency installation, builds,
and validation. Workspace discovery, manifest rewriting, and npm publishing are
implemented by the local `.github/actions/publish-workspaces` action.

The root `workspaces` field is the publish contract. Non-private workspace
packages with a name and version are publishable; private workspaces and helper
manifests outside those patterns are ignored. Each publish sorts the selected
packages by their internal dependencies so dependencies are available before
their dependents.

Before a stable publish, internal `workspace:` dependencies are rewritten to the
selected package's locked version while preserving the declared modifier:
`workspace:*` and `workspace:` become an exact version, `workspace:^` and
`workspace:~` become the corresponding range, and explicit ranges are preserved.
Before a canary publish, all internal dependency fields are rewritten to that
PR's exact canary versions. Publishing fails before uploading any package if a
consumer-facing dependency still contains an unresolved `workspace:` spec, such
as a dependency on a private workspace.

`@datasworn-community/core` and `@datasworn-community/build-tools` are
**versioned together** (a single locked version, e.g. `0.2.0`). build-tools
declares core as an exact-pinned `peerDependency`, and `bun run validate`
fails if that pin drifts from core's version. The npm package version is
distinct from the schema `datasworn_version` (the on-disk data format), which
moves on its own cadence.

## Publishing a release

Publishing is automatic after changes land on `main`. The release workflow
builds and validates the repository, plans the next version from the changed
files and the merged PR's release label, and then runs `release-it`. Non-schema
changes default to a patch release; schema-sensitive changes must declare their
release intent through the PR's `release:*` label.

`release-it` then:

1. Bump the version and run `scripts/setVersion.ts` (`after:bump` hook) so
   core, build-tools, and the build-tools → core peer pin all move to the new
   version in lockstep.
2. Commit `chore: release v<version>`, create the annotated tag `v<version>`,
   and push both.
3. Open a GitHub release for the tag.
4. Publish both packages with provenance through npm Trusted Publishing (OIDC).

A manually pushed `v*` tag remains a fallback release path and runs the local tag
publish job. Automatic, tag-driven, and canary publishes all originate from
`.github/workflows/release.yml`; register its filename, `release.yml`, as the npm
trusted-publisher workflow. GitHub's OIDC identity is tied to that local workflow
even though its build step uses the shared `bun-build` action. Watch the run under
the repo's **Actions** tab and confirm the new versions appear on npm before
announcing.

### Experimental (canary) publishes

To publish a throwaway build from an open PR, add the `release_experimental`
label to it. While the label is present, every push publishes canaries under
the `pr-<number>` npm dist-tag (e.g. `npm i @datasworn-community/core@pr-42`);
a sticky PR comment lists both tagged and exact install commands. Exact versions
use `<base>-experimental.<pr-number>.<12-character-head-sha>`, and internal
workspace dependencies point to those exact versions. Remove the label to stop
future publishes. Canaries never touch the `latest` tag. The per-PR dist-tag
remains after the PR closes as a convenience alias and can move when a new canary
is published; use the exact version for reproducible installs. Canaries run on
internal branches only so untrusted fork code cannot reach the npm
trusted-publishing job.
