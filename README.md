# Datasworn Community

Clean-history home for the core Datasworn runtime package and build tooling.

This repository publishes:

- `@datasworn-community/core`
- `@datasworn-community/build-tools`

The repository starts as a scaffold for Phase 1 of the Datasworn restructure.
Implementation files copied or adapted from upstream Datasworn must be recorded
in `PROVENANCE.md`.

## Development

```sh
bun install
bun run build
bun run validate
```

## Release Model

Shared CI and publish workflows are called from
`datasworn-community/.github/.github/workflows/*@v1`.

The root `workspaces` field is the publish contract. Non-private workspace
packages are published in internal dependency order by the shared release
workflow.

`@datasworn-community/core` and `@datasworn-community/build-tools` are
**versioned together** (a single locked version, e.g. `0.2.0`). build-tools
declares core as an exact-pinned `peerDependency`, and `bun run validate`
fails if that pin drifts from core's version. The npm package version is
distinct from the schema `datasworn_version` (the on-disk data format), which
moves on its own cadence.

## Publishing a release

Publishing is **tag-driven**: a `v*` tag triggers the shared release workflow,
which builds and runs `npm publish --provenance` for each package via npm
Trusted Publishing (OIDC). You do not run `npm publish` by hand. Cut releases
from an up-to-date, clean `main`:

```sh
git checkout main && git pull
bun install && bun run validate   # must be green before releasing
bunx release-it minor             # or: patch | major | <explicit-version>
```

`release-it` will:

1. Bump the version and run `scripts/setVersion.ts` (`after:bump` hook) so
   core, build-tools, and the build-tools → core peer pin all move to the new
   version in lockstep.
2. Commit `chore: release v<version>`, create the annotated tag `v<version>`,
   and push both.
3. Open a GitHub release for the tag.

Pushing the tag is what publishes: the
`datasworn-community/.github` release workflow picks it up and publishes both
packages to npm with provenance. Watch the run under the repo's **Actions** tab
and confirm the new versions appear on npm before announcing.

### Experimental (canary) publishes

To publish a throwaway build from an open PR, add the `release_experimental`
label to it. While the label is present, every push publishes canaries under
the `pr-<number>` npm dist-tag (e.g. `npm i @datasworn-community/core@pr-42`);
a sticky PR comment lists the exact install commands. Remove the label to stop.
Canaries never touch the `latest` tag, and the dist-tag is cleaned up when the
PR closes. (Canaries run on internal branches only — fork PRs cannot access the
publish secrets.)
