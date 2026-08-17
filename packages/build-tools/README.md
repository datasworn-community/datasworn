# @datasworn-community/build-tools

Build and migration tools for Datasworn source packages.

`datasworn-build` reads JSON/YAML Datasworn source files, validates them against
the schemas shipped by `@datasworn-community/core`, assigns Datasworn IDs, merges
the files, validates the built package, and writes distribution JSON.

`datasworn-migrate` applies Datasworn ID replacement maps to JSON files.

The build tools resolve core's shipped schemas at runtime through
`@datasworn-community/core/json/*`, so consumers should install matching versions
of `@datasworn-community/core` and `@datasworn-community/build-tools`.

Multi-package content builds can also write a checked-in, GitHub-friendly raw
JSON directory by setting `publicJsonOutDir`:

```yaml
outDir: datasworn
publicJsonOutDir: generated-datasworn
packageOutDir: dist/packages
```

This writes flat `<package-id>.json` files, `manifest.json`, and `README.md`.
Do not edit those generated files by hand.

## In-memory builds

Embedded consumers such as Iron Vault can compile already-parsed fragments with
`RulesPackageBuilder`. Import it from `@datasworn-community/build-tools`, rather
than from a deep path in core, and initialize it with synchronous schema
validators before constructing a builder:

```ts
import { RulesPackageBuilder } from '@datasworn-community/build-tools'

RulesPackageBuilder.init({ validator, sourceValidator })

const builder = new RulesPackageBuilder('my_ruleset', console)
builder.addFiles(
	{ name: 'package.md', data: packageFragment },
	{ name: 'oracles/characters.md', data: oracleFragment }
)

if (builder.errors.has('oracles/characters.md')) {
	builder.files.delete('oracles/characters.md')
	builder.errors.delete('oracles/characters.md')
}

const data = builder.build().toJSON()
```

`files` and `errors` are keyed by fragment name, so consumers can inspect or
remove individual inputs before rebuilding. Semantic oracle validation runs as
part of `build()`. ID-reference validation remains a separate exported operation:
call `validateIdRefs(data, tree)` when the assembled package and its dependency
tree are available.

The upstream TypeBox schema source is imported under `schema-source/` as source
material for the schema generation work. Runtime validation uses the generated
schemas shipped by core.
