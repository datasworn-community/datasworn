import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import {
	DATASWORN_SCHEMA_VERSION,
	type Datasworn
} from '@datasworn-community/core'
import {
	buildContentPackages,
	buildRulesPackage,
	extractIdRefs,
	loadCoreSchema,
	resolveCoreSchemaPath,
	validateIdRefs
} from '@datasworn-community/build-tools'

const schemaLine = DATASWORN_SCHEMA_VERSION.split('.').slice(0, 2).join('.')
const repository = {
	type: 'git',
	url: 'git+https://github.com/datasworn-community/fixture-content.git'
}

describe('@datasworn-community/build-tools', () => {
	test('loads JSON schemas shipped by core', async () => {
		const schemaPath = resolveCoreSchemaPath('datasworn.schema.json')
		const schema = await loadCoreSchema('datasworn.schema.json')

		expect(schemaPath.endsWith('packages/core/json/datasworn.schema.json')).toBe(
			true
		)
		expect(schema.title).toBe(`Datasworn v${DATASWORN_SCHEMA_VERSION}`)
	})

	test('builds a rules package from source files', async () => {
		const workDir = await mkdtemp(path.join(tmpdir(), 'datasworn-build-'))
		const sourceDir = path.join(workDir, 'source')
		const outDir = path.join(workDir, 'out')
		await mkdir(sourceDir, { recursive: true })

		await writeFile(
			path.join(sourceDir, 'ruleset.json'),
			`${JSON.stringify({
				_id: 'fixture',
				type: 'ruleset',
				datasworn_version: DATASWORN_SCHEMA_VERSION,
				title: 'Fixture',
				authors: [
					{
						name: 'Datasworn Community'
					}
				],
				date: '2026-01-01',
				url: 'https://example.com',
				license: 'https://opensource.org/licenses/MIT',
				oracles: {},
				moves: {},
				assets: {},
				truths: {},
				rules: {
					stats: {},
					condition_meters: {},
					impacts: {},
					special_tracks: {},
					tags: {}
				}
			})}\n`
		)

		const result = await buildRulesPackage({
			id: 'fixture',
			type: 'ruleset',
			source: sourceDir,
			outDir
		})

		const output = JSON.parse(await readFile(result.outFile, 'utf8')) as {
			_id: string
			datasworn_version: string
		}

		expect(result.files).toHaveLength(1)
		expect(output._id).toBe('fixture')
		expect(output.datasworn_version).toBe(DATASWORN_SCHEMA_VERSION)
	})

	test('normalizes YAML merges, schema version, and source defaults', async () => {
		const workDir = await mkdtemp(path.join(tmpdir(), 'datasworn-yaml-'))
		const sourceDir = path.join(workDir, 'source')
		const outDir = path.join(workDir, 'out')
		await mkdir(sourceDir, { recursive: true })

		await writeFile(
			path.join(sourceDir, 'ruleset.yaml'),
			`_id: fixture
type: ruleset
datasworn_version: "0.1.0"
<<: &Source
  title: Fixture
  authors:
    - name: Datasworn Community
  date: 2026-01-01
  url: https://example.com
  license: https://opensource.org/licenses/MIT
rules:
  stats: {}
  condition_meters: {}
  impacts: {}
  special_tracks: {}
  tags: {}
`
		)

		const result = await buildRulesPackage({
			id: 'fixture',
			type: 'ruleset',
			source: sourceDir,
			outDir
		})
		const output = JSON.parse(await readFile(result.outFile, 'utf8')) as {
			datasworn_version: string
			oracles: Record<string, unknown>
			moves: Record<string, unknown>
			assets: Record<string, unknown>
			truths: Record<string, unknown>
		}

		expect(output.datasworn_version).toBe(DATASWORN_SCHEMA_VERSION)
		expect(output.oracles).toEqual({})
		expect(output.moves).toEqual({})
		expect(output.assets).toEqual({})
		expect(output.truths).toEqual({})
	})

	test('materializes YAML aliases before assigning IDs', async () => {
		const workDir = await mkdtemp(path.join(tmpdir(), 'datasworn-yaml-'))
		const sourceDir = path.join(workDir, 'source')
		const outDir = path.join(workDir, 'out')
		await mkdir(sourceDir, { recursive: true })

		await writeFile(
			path.join(sourceDir, 'ruleset.yaml'),
			`_id: fixture
type: ruleset
datasworn_version: "0.1.0"
title: Fixture
authors:
  - name: Datasworn Community
date: 2026-01-01
url: https://example.com
license: https://opensource.org/licenses/MIT
rules:
  stats: {}
  condition_meters: {}
  impacts: {}
  special_tracks: {}
  tags: {}
oracles:
  fixture:
    name: Fixture Oracles
    type: oracle_collection
    oracle_type: tables
    _source: &Source
      authors:
        - name: Datasworn Community
      title: Fixture
      license: https://opensource.org/licenses/MIT
      url: https://example.com
      date: 2026-01-01
    contents:
      first:
        name: First
        type: oracle_rollable
        oracle_type: table_text
        _source: *Source
        rows:
          - &SharedRow
            roll: { min: 1, max: 1 }
            text: Shared
      second:
        name: Second
        type: oracle_rollable
        oracle_type: table_text
        _source: *Source
        rows:
          - *SharedRow
`
		)

		const result = await buildRulesPackage({
			id: 'fixture',
			type: 'ruleset',
			source: sourceDir,
			outDir
		})
		const output = JSON.parse(
			await readFile(result.outFile, 'utf8')
		) as Datasworn.RulesPackage
		const fixtureOracles = output.oracles.fixture
		if (fixtureOracles.type !== 'oracle_collection')
			throw new Error('Expected oracle collection')
		const first = fixtureOracles.contents.first
		const second = fixtureOracles.contents.second
		if (first.type !== 'oracle_rollable' || second.type !== 'oracle_rollable')
			throw new Error('Expected rollable oracles')

		expect(first.rows[0]._id).toBe('oracle_rollable.row:fixture/fixture/first.0')
		expect(second.rows[0]._id).toBe('oracle_rollable.row:fixture/fixture/second.0')
	})
})

async function writeMinimalRuleset(
	sourceDir: string,
	id: string,
	extra: Record<string, unknown> = {}
) {
	await mkdir(sourceDir, { recursive: true })
	await writeFile(
		path.join(sourceDir, 'ruleset.json'),
		`${JSON.stringify({
			_id: id,
			type: 'ruleset',
			datasworn_version: DATASWORN_SCHEMA_VERSION,
			title: id,
			authors: [
				{
					name: 'Datasworn Community'
				}
			],
			date: '2026-01-01',
			url: 'https://example.com',
			license: 'https://opensource.org/licenses/MIT',
			oracles: {},
			moves: {},
			assets: {},
			truths: {},
			rules: {
				stats: {},
				condition_meters: {},
				impacts: {},
				special_tracks: {},
				tags: {}
			},
			...extra
		})}\n`
	)
}

describe('buildContentPackages', () => {
	test('builds packages in dependency order and writes publishable artifacts', async () => {
		const workDir = await mkdtemp(path.join(tmpdir(), 'datasworn-content-'))
		const baseSource = path.join(workDir, 'source', 'base')
		const expansionSource = path.join(workDir, 'source', 'expansion')
		const assetSource = path.join(workDir, 'assets', 'icons')
		const outDir = path.join(workDir, 'datasworn')
		const publicJsonOutDir = path.join(workDir, 'generated-datasworn')
		const packageOutDir = path.join(workDir, 'packages')
		await writeMinimalRuleset(baseSource, 'base')
		await writeMinimalRuleset(expansionSource, 'expansion')
		await mkdir(assetSource, { recursive: true })
		await writeFile(path.join(assetSource, 'icon.svg'), '<svg />\n')

		const result = await buildContentPackages({
			outDir,
			publicJsonOutDir,
			packageOutDir,
			repository,
			packages: [
				{
					id: 'expansion',
					type: 'ruleset',
					source: expansionSource,
					packageName: '@datasworn-community/expansion',
					schemaLine,
					version: `${schemaLine}.4`,
					dependencies: ['base'],
					assets: [assetSource]
				},
				{
					id: 'base',
					type: 'ruleset',
					source: baseSource,
					packageName: '@datasworn-community/base',
					schemaLine,
					version: `${schemaLine}.3`
				}
			]
		})

		expect(result.buildOrder).toEqual(['base', 'expansion'])

		const expansionPackage = JSON.parse(
			await readFile(
				path.join(packageOutDir, 'expansion', 'package.json'),
				'utf8'
			)
		) as {
			version: string
			dependencies: Record<string, string>
			exports: Record<string, unknown>
			files: string[]
			repository: typeof repository
		}
		const expansionIndex = await readFile(
			path.join(packageOutDir, 'expansion', 'index.js'),
			'utf8'
		)
		const expansionAsset = await readFile(
			path.join(packageOutDir, 'expansion', 'icons', 'icon.svg'),
			'utf8'
		)
		const generatedExpansion = JSON.parse(
			await readFile(path.join(publicJsonOutDir, 'expansion.json'), 'utf8')
		) as Datasworn.RulesPackage
		const generatedManifest = JSON.parse(
			await readFile(path.join(publicJsonOutDir, 'manifest.json'), 'utf8')
		) as {
			datasworn_version: string
			packages: Record<
				string,
				{
					version: string
					schemaLine: string
					packageName: string
					path: string
					dependencies?: string[]
				}
			>
		}
		const generatedReadme = await readFile(
			path.join(publicJsonOutDir, 'README.md'),
			'utf8'
		)

		expect(expansionPackage.version).toBe(`${schemaLine}.4`)
		expect(expansionPackage.dependencies).toMatchObject({
			'@datasworn-community/base': `^${schemaLine}.0`,
			'@datasworn-community/core': `^${schemaLine}.0`
		})
		expect(expansionPackage.files).toContain('icons')
		expect(expansionPackage.exports).toMatchObject({
			'./icons/*': './icons/*'
		})
		expect(expansionPackage.repository).toEqual(repository)
		expect(expansionIndex).toContain("./json/expansion.json")
		expect(expansionAsset).toBe('<svg />\n')
		expect(generatedExpansion._id).toBe('expansion')
		expect(generatedManifest.datasworn_version).toBe(DATASWORN_SCHEMA_VERSION)
		expect(Object.keys(generatedManifest.packages)).toEqual(['base', 'expansion'])
		expect(generatedManifest.packages.expansion).toMatchObject({
			version: `${schemaLine}.4`,
			schemaLine,
			packageName: '@datasworn-community/expansion',
			path: 'expansion.json',
			dependencies: ['base']
		})
		expect(generatedReadme).toContain('Do not edit these files by hand.')
	})

	test('requires repository metadata for generated package manifests', async () => {
		await expect(
			buildContentPackages({
				packages: []
			} as any)
		).rejects.toThrow('Multi-package content build config requires repository')
	})

	test('validates optional in-repo references against the full package tree', async () => {
		const workDir = await mkdtemp(path.join(tmpdir(), 'datasworn-content-'))
		const baseSource = path.join(workDir, 'source', 'base')
		const expansionSource = path.join(workDir, 'source', 'expansion')

		await writeMinimalRuleset(baseSource, 'base', {
			description: 'Optional reference to [the relic](datasworn:rarity:expansion/relic).'
		})
		await writeMinimalRuleset(expansionSource, 'expansion', {
			assets: {
				path: {
					name: 'Path Assets',
					type: 'asset_collection',
					_source: {
						title: 'Fixture',
						authors: [{ name: 'Datasworn Community' }],
						date: '2026-01-01',
						url: 'https://example.com',
						license: 'https://opensource.org/licenses/MIT'
					},
					contents: {
						relic_bearer: {
							name: 'Relic Bearer',
							type: 'asset',
							category: 'Path',
							_source: {
								title: 'Fixture',
								authors: [{ name: 'Datasworn Community' }],
								date: '2026-01-01',
								url: 'https://example.com',
								license: 'https://opensource.org/licenses/MIT'
							},
							abilities: [
								{
									text: 'You carry a relic.'
								}
							]
						}
					}
				},
			},
			rarities: {
				relic: {
					name: 'Relic',
					type: 'rarity',
					_source: {
						title: 'Fixture',
						authors: [{ name: 'Datasworn Community' }],
						date: '2026-01-01',
						url: 'https://example.com',
						license: 'https://opensource.org/licenses/MIT'
					},
					asset: 'asset:expansion/path/relic_bearer',
					description: 'A relic.'
				}
			}
		})

		const result = await buildContentPackages({
			outDir: path.join(workDir, 'datasworn'),
			packageOutDir: path.join(workDir, 'packages'),
			repository,
			packages: [
				{
					id: 'expansion',
					type: 'ruleset',
					source: expansionSource,
					packageName: '@datasworn-community/expansion',
					schemaLine,
					dependencies: ['base']
				},
				{
					id: 'base',
					type: 'ruleset',
					source: baseSource,
					packageName: '@datasworn-community/base',
					schemaLine
				}
			]
		})

		expect(result.buildOrder).toEqual(['base', 'expansion'])
	})
})

describe('extractIdRefs', () => {
	test('collects ID references from reference fields', () => {
		const refs = extractIdRefs({
			oracle: 'oracle_rollable:classic/action',
			nested: { enhances: ['move:delve/secret_of_the_site'] }
		})

		expect([...refs].sort()).toEqual([
			'move:delve/secret_of_the_site',
			'oracle_rollable:classic/action'
		])
	})

	test('extracts IDs embedded in markdown links and macros', () => {
		const refs = extractIdRefs({
			text: 'Roll [the action oracle](datasworn:oracle_rollable:classic/action) then {{table>oracle_rollable:classic/theme}}.'
		})

		expect(refs.has('oracle_rollable:classic/action')).toBe(true)
		expect(refs.has('oracle_rollable:classic/theme')).toBe(true)
	})

	test('ignores own _id, plain-text/url fields, and non-ID strings', () => {
		const refs = extractIdRefs({
			_id: 'oracle_rollable:classic/action',
			name: 'oracle_rollable:classic/action',
			url: 'https://example.com/a:b/c',
			label: 'Pick one',
			summary: 'No identifiers here.'
		})

		expect(refs.size).toBe(0)
	})
})

describe('validateIdRefs (cross-package preloading)', () => {
	// A minimal traversable tree: a `rarity` is a non-collectable node at
	// `rarities.<key>`, addressable as `rarity:base/relic`.
	const dependency = {
		_id: 'base',
		type: 'ruleset',
		rarities: { relic: { _id: 'rarity:base/relic' } }
	} as unknown as Datasworn.RulesPackage
	const referencing = {
		description: 'See [the relic](datasworn:rarity:base/relic).'
	}

	test('references resolve when the dependency package is in the tree', () => {
		const report = validateIdRefs(referencing, { base: dependency })

		expect([...report.valid]).toEqual(['rarity:base/relic'])
		expect(report.unreachable.size).toBe(0)
		expect(report.invalid.size).toBe(0)
	})

	test('references are unreachable without the dependency', () => {
		const report = validateIdRefs(referencing, {})

		expect(report.unreachable.has('rarity:base/relic')).toBe(true)
		expect(report.valid.size).toBe(0)
	})
})
