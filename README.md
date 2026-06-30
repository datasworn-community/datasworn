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
