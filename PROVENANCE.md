# Provenance

This repository starts with clean history. It is intended to host the
`@datasworn-community/core` and `@datasworn-community/build-tools` packages while
preserving clear attribution for upstream Datasworn work.

## Upstream Reference

- Original creator: [rsek](https://github.com/rsek)
- Upstream community fork: [tbsvttr/datasworn](https://github.com/tbsvttr/datasworn)
- Source commit selected for Phase 1 imports:
  `b27bc91c25039f23a72ffc061d6e2394f779643e`

## Ticket 1.0 Import Record

Ticket 1.0 creates the repository scaffold only. It does not import upstream
implementation files or game content.

The following upstream areas are planned sources for later Phase 1 tickets and
must be recorded here when copied or adapted:

| Upstream path | Target area | Planned ticket | Imported? |
| --- | --- | --- | --- |
| `src/pkg-core/` | `packages/core/src/` | 1.1 | No |
| `src/schema/` | `packages/build-tools/src/schema/` | 1.2 | No |
| `src/scripts/` | `packages/build-tools/src/` and `scripts/` | 1.2 | No |
| `src/pkg-core/Builders/` | `packages/build-tools/src/` | 1.2 | No |
| `src/pkg-core/Validators/` | `packages/build-tools/src/` | 1.2 | No |

Official content source data and community content are intentionally not part of
this repository. They move in later restructure phases.

## License Notes

The upstream README at the selected source commit describes core package code,
typings, schema, and tooling as MIT licensed. Game content has separate Creative
Commons licensing and is out of scope for this repository.

No root `LICENSE.md` file was present in the local upstream checkout at the
selected source commit, so this repository carries its own MIT license for the
new scaffold and will preserve upstream notices on imported files when those
imports happen.
