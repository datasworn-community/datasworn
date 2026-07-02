# Provenance

This repository starts with clean history. It is intended to host the
`@datasworn-community/core` and `@datasworn-community/build-tools` packages while
preserving clear attribution for upstream Datasworn work.

## Upstream Reference

- Original creator: [rsek](https://github.com/rsek)
- Upstream community fork: [tbsvttr/datasworn](https://github.com/tbsvttr/datasworn)
- Source commit selected for Phase 1 imports:
  `b27bc91c25039f23a72ffc061d6e2394f779643e`

## Import Record

Ticket 1.0 creates the repository scaffold only. It does not import upstream
implementation files or game content.

Ticket 1.1 imports runtime core implementation files from upstream source commit
`b27bc91c25039f23a72ffc061d6e2394f779643e` and adapts the package layout for
dual ESM/CJS publishing. `Builders` and `Validators` are intentionally not
imported into `@datasworn-community/core`; they move to
`@datasworn-community/build-tools` in Ticket 1.2.

Ticket 1.2 imports the generated upstream JSON schemas and current migration map
into `@datasworn-community/core`, then adapts the build/migration tool surface
for the split package layout in `@datasworn-community/build-tools`.

Ticket 1.4 imports the upstream schema/type codegen pipeline (JSON schema
generation, TypeScript declaration generation, and the JSON TypeDef builder it
depends on) into `packages/build-tools/schema-source/scripts/` and
`packages/build-tools/schema-source/builders/`, adapting `pkg-core`-relative
imports to go through `@datasworn-community/core`'s public API (`IdElements`,
`Utils`, `TypeNode` namespaces, newly exported from core's index for this
purpose) since build-tools and core are now separate workspace packages.

The following upstream areas are planned sources for later Phase 1 tickets and
must be recorded here when copied or adapted:

| Upstream path | Target area | Planned ticket | Imported? |
| --- | --- | --- | --- |
| `src/pkg-core/Datasworn.ts` | `packages/core/src/Datasworn.ts` | 1.1 | Yes |
| `src/pkg-core/DataswornSource.ts` | `packages/core/src/DataswornSource.ts` | 1.1 | Yes |
| `src/pkg-core/DataswornTree.ts` | `packages/core/src/DataswornTree.ts` | 1.1 | Yes |
| `src/pkg-core/Errors.ts` | `packages/core/src/Errors.ts` | 1.1 | Yes |
| `src/pkg-core/IdElements/` | `packages/core/src/IdElements/` | 1.1 | Yes |
| `src/pkg-core/IdParser.ts` | `packages/core/src/IdParser.ts` | 1.1 | Yes |
| `src/pkg-core/Migrations/` | `packages/core/src/Migrations/` | 1.1 | Yes |
| `src/pkg-core/StringId.ts` | `packages/core/src/StringId.ts` | 1.1 | Yes |
| `src/pkg-core/Tree.ts` | `packages/core/src/Tree.ts` | 1.1 | Yes |
| `src/pkg-core/TypeNode.ts` | `packages/core/src/TypeNode.ts` | 1.1 | Yes |
| `src/pkg-core/Utils/` | `packages/core/src/Utils/` | 1.1 | Yes |
| `src/pkg-core/mergeExpansion.ts` | `packages/core/src/mergeExpansion.ts` | 1.1 | Yes |
| `datasworn/datasworn.schema.json` | `packages/core/json/datasworn.schema.json` | 1.2 | Yes |
| `datasworn/datasworn-source.schema.json` | `packages/core/json/datasworn-source.schema.json` | 1.2 | Yes |
| `src/migration/history/0.1.0/id_regex_map.json` | `packages/core/migration/0.1.0/id_regex_map.json` | 1.2 | Yes |
| `src/schema/` | `packages/build-tools/schema-source/schema/` | 1.2 | Yes |
| `src/scripts/` | `packages/build-tools/src/` and `scripts/` | 1.2 | Adapted |
| `src/pkg-core/Builders/` | `packages/build-tools/src/rules-package-builder.ts` | 1.2 | Adapted |
| `src/pkg-core/Validators/` | `packages/build-tools/src/validators.ts` | 1.2 | Adapted |
| `src/scripts/schema/buildSchema.ts` | `packages/build-tools/schema-source/scripts/schema/buildSchema.ts` | 1.4 | Adapted |
| `src/scripts/codegen/` | `packages/build-tools/schema-source/scripts/codegen/` | 1.4 | Adapted |
| `src/scripts/datasworn/sort.ts` | `packages/build-tools/schema-source/scripts/datasworn/sort.ts` | 1.4 | Adapted |
| `src/scripts/augmentations.ts` | `packages/build-tools/schema-source/scripts/augmentations.ts` | 1.4 | Adapted |
| `src/scripts/utils/readWrite.ts` | `packages/build-tools/schema-source/scripts/utils/readWrite.ts` | 1.4 | Adapted |
| `src/scripts/utils/Log.ts` | `packages/build-tools/schema-source/scripts/utils/Log.ts` | 1.4 | Reimplemented (console shim, no winston/logform) |
| `src/scripts/validation/{ajv,formats,keywords}.ts` | `packages/build-tools/schema-source/scripts/validation/` | 1.4 | Adapted |
| `src/scripts/json-typedef/typedef.ts` | `packages/build-tools/schema-source/scripts/json-typedef/typedef.ts` | 1.4 | Yes |
| `src/scripts/json-typedef/utils.ts` | `packages/build-tools/schema-source/scripts/json-typedef/utils.ts` | 1.4 | Yes |
| `src/builders/IdBuilder.ts` | `packages/build-tools/schema-source/builders/IdBuilder.ts` | 1.4 | Adapted |

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
