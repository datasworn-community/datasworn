# @datasworn-community/build-tools

Build and migration tools for Datasworn source packages.

`datasworn-build` reads JSON/YAML Datasworn source files, validates them against
the schemas shipped by `@datasworn-community/core`, assigns Datasworn IDs, merges
the files, validates the built package, and writes distribution JSON.

`datasworn-migrate` applies Datasworn ID replacement maps to JSON files.

The build tools resolve core's shipped schemas at runtime through
`@datasworn-community/core/json/*`, so consumers should install matching versions
of `@datasworn-community/core` and `@datasworn-community/build-tools`.

The upstream TypeBox schema source is imported under `schema-source/` as source
material for the schema generation work. Runtime validation uses the generated
schemas shipped by core.
