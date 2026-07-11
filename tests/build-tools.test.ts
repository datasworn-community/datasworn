import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import {
	DATASWORN_SCHEMA_VERSION,
	type Datasworn,
	type DataswornSource
} from '@datasworn-community/core'
import {
	extractIdRefs,
	RulesPackageBuilder,
	validateDiceRange,
	validateOracleCollection,
	validateOracleRollable,
	validateIdRefs
} from '@datasworn-community/build-tools'
import {
	buildContentPackages,
	buildRulesPackage,
	loadCoreSchema,
	resolveCoreSchemaPath
} from '@datasworn-community/build-tools/node'

const schemaLine = DATASWORN_SCHEMA_VERSION.split('.').slice(0, 2).join('.')
const repository = {
	type: 'git',
	url: 'git+https://github.com/datasworn-community/fixture-content.git'
}

describe('@datasworn-community/build-tools', () => {
	test('builds in-memory source fragments after callers remove an invalid file', () => {
		const outputValidator = (value: unknown): value is Datasworn.RulesPackage =>
			typeof value === 'object' && value !== null
		const sourceValidator = (
			value: unknown
		): value is DataswornSource.RulesPackage => {
			if (
				typeof value === 'object' &&
				value !== null &&
				'invalid' in value
			)
				throw new Error('invalid source fragment')
			return true
		}

		RulesPackageBuilder.init({
			validator: outputValidator,
			sourceValidator
		})
		expect(RulesPackageBuilder.isInitialized).toBe(true)
		expect(RulesPackageBuilder.schemaValidator).toBe(outputValidator)
		expect(RulesPackageBuilder.sourceSchemaValidator).toBe(sourceValidator)

		const builder = new RulesPackageBuilder('fixture', console)
		builder.addFiles(
			{
				name: 'b.json',
				data: {
					_id: 'fixture',
					type: 'ruleset',
					datasworn_version: DATASWORN_SCHEMA_VERSION,
					title: 'Fixture'
				} as DataswornSource.RulesPackage
			},
			{
				name: 'bad.json',
				data: { invalid: true } as unknown as DataswornSource.RulesPackage
			},
			{
				name: 'a.json',
				data: {
					authors: [{ name: 'Datasworn Community' }],
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
				} as DataswornSource.RulesPackage
			}
		)

		expect(builder.errors.get('bad.json')).toBeInstanceOf(Error)
		builder.files.delete('bad.json')
		builder.errors.delete('bad.json')

		expect(builder.build()).toBe(builder)
		expect(builder.toJSON()).toMatchObject({
			_id: 'fixture',
			type: 'ruleset',
			title: 'Fixture'
		})
	})

	test('rejects a gap between numbered oracle rows across a cosmetic row', () => {
		RulesPackageBuilder.init({
			validator: (_value): _value is Datasworn.RulesPackage => true,
			sourceValidator: (
				_value
			): _value is DataswornSource.RulesPackage =>
				true
		})
		const builder = new RulesPackageBuilder('fixture', console)
		builder.addFiles({
			name: 'oracles.json',
			data: inMemoryRuleset({
				oracles: {
					fixture: {
						name: 'Fixture Oracles',
						type: 'oracle_collection',
						oracle_type: 'tables',
						_source: sourceInfo,
						contents: {
							broken: {
								name: 'Broken Table',
								type: 'oracle_rollable',
								oracle_type: 'table_text',
								_source: sourceInfo,
								dice: '1d6',
								rows: [
									{ roll: { min: 1, max: 2 }, text: 'First' },
									{ roll: null, text: 'Decoration' },
									{ roll: { min: 4, max: 6 }, text: 'Last' }
								]
							}
						}
					}
				}
			})
		})

		expect(() => builder.build()).toThrow('not sequential')
	})

	test('rejects inconsistent shared text in an oracle collection', () => {
		RulesPackageBuilder.init({
			validator: (_value): _value is Datasworn.RulesPackage => true,
			sourceValidator: (
				_value
			): _value is DataswornSource.RulesPackage =>
				true
		})
		const builder = new RulesPackageBuilder('fixture', console)
		builder.addFiles({
			name: 'oracles.json',
			data: inMemoryRuleset({
				oracles: {
					shared: {
						name: 'Shared Result',
						type: 'oracle_collection',
						oracle_type: 'table_shared_text',
						_source: sourceInfo,
						contents: {
							first: {
								name: 'First Roll',
								type: 'oracle_rollable',
								oracle_type: 'column_text',
								dice: '1d2',
								rows: [
									{ roll: { min: 1, max: 1 }, text: 'Shared' },
									{ roll: { min: 2, max: 2 }, text: 'Ending' }
								]
							},
							second: {
								name: 'Second Roll',
								type: 'oracle_rollable',
								oracle_type: 'column_text',
								dice: '1d2',
								rows: [
									{ roll: { min: 1, max: 1 }, text: 'Different' },
									{ roll: { min: 2, max: 2 }, text: 'Ending' }
								]
							}
						}
					}
				}
			})
		})

		expect(() => builder.build()).toThrow(
			'table_shared_text child OracleRollables must have the same text content'
		)
	})

	test('rejects a reversed dice range through the public validator export', () => {
		expect(() => validateDiceRange({ min: 6, max: 1 })).toThrow(
			'DiceRange min (6) is greater than max (1)'
		)
	})

	test('rejects oracle rows outside the possible dice bounds', () => {
		expect(() =>
			validateOracleRollable({
				dice: '1d6',
				rows: [{ roll: { min: 1, max: 7 }, text: 'Impossible' }]
			} as Datasworn.OracleRollable)
		).toThrow('greater than the maximum possible roll of 1d6 (6)')
	})

	test('rejects mismatched roll ranges in table_shared_rolls children', () => {
		expect(() =>
			validateOracleCollection({
				oracle_type: 'table_shared_rolls',
				contents: {
					first: {
						rows: [{ roll: { min: 1, max: 2 }, text: 'First' }]
					},
					second: {
						rows: [{ roll: { min: 1, max: 3 }, text: 'Second' }]
					}
				}
			} as unknown as Datasworn.OracleCollection)
		).toThrow(
			'table_shared_rolls child OracleRollables must have the same roll ranges'
		)
	})

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

	test('builds multiple named worlds without changing truth IDs', async () => {
		const workDir = await mkdtemp(path.join(tmpdir(), 'datasworn-worlds-'))
		const sourceDir = path.join(workDir, 'source')
		const outDir = path.join(workDir, 'out')
		await writeMinimalRuleset(sourceDir, 'fixture', {
			truths: {
			origin: {
				name: 'Origin',
				type: 'truth',
				dice: '1d100',
				_source: {
					title: 'Fixture',
					authors: [{ name: 'Datasworn Community' }],
					date: '2026-01-01',
					url: 'https://example.com',
					license: 'https://opensource.org/licenses/MIT'
				},
				options: []
			},
			legacy: {
				name: 'Legacy',
				type: 'truth',
				dice: '1d100',
				_source: {
					title: 'Fixture',
					authors: [{ name: 'Datasworn Community' }],
					date: '2026-01-01',
					url: 'https://example.com',
					license: 'https://opensource.org/licenses/MIT'
				},
				options: []
			}
		},
		worlds: {
			first: {
				name: 'The First World',
				truths: ['truth:fixture/origin', 'truth:fixture/legacy']
			},
			second: {
				name: 'The Second World',
				truths: ['truth:fixture/legacy']
			}
		}
	})

		const result = await buildRulesPackage({
			id: 'fixture',
			type: 'ruleset',
			source: sourceDir,
			outDir
		})
		const data = result.data
		if (data.worlds == null) throw new Error('Expected worlds')

		expect(data.worlds.first.name).toBe('The First World')
		expect(data.worlds.first.truths).toEqual([
			'truth:fixture/origin',
			'truth:fixture/legacy'
		])
		expect(data.worlds.second.truths).toEqual(['truth:fixture/legacy'])
		expect('_id' in data.worlds.first).toBe(false)
		if (data.truths == null) throw new Error('Expected truths')
		expect(data.truths.origin._id).toBe('truth:fixture/origin')
		expect(data.truths.legacy._id).toBe('truth:fixture/legacy')

		const emitted = JSON.parse(
			await readFile(result.outFile, 'utf8')
		) as Datasworn.RulesPackage
		if (emitted.worlds == null) throw new Error('Expected emitted worlds')
		expect(emitted.worlds.first).toEqual({
			name: 'The First World',
			truths: ['truth:fixture/origin', 'truth:fixture/legacy']
		})
	})

	test('rejects duplicate truths within a world', async () => {
		const workDir = await mkdtemp(path.join(tmpdir(), 'datasworn-worlds-'))
		const sourceDir = path.join(workDir, 'source')
		await writeMinimalRuleset(sourceDir, 'fixture', {
			worlds: {
				forge: {
					name: 'The Forge',
					truths: ['truth:fixture/origin', 'truth:fixture/origin']
				}
			}
		})

		expect(
			buildRulesPackage({ id: 'fixture', type: 'ruleset', source: sourceDir })
		).rejects.toThrow('must NOT have duplicate items')
	})

	test('rejects an empty world truth set', async () => {
		const workDir = await mkdtemp(path.join(tmpdir(), 'datasworn-worlds-'))
		const sourceDir = path.join(workDir, 'source')
		await writeMinimalRuleset(sourceDir, 'fixture', {
			worlds: { forge: { name: 'The Forge', truths: [] } }
		})

		expect(
			buildRulesPackage({ id: 'fixture', type: 'ruleset', source: sourceDir })
		).rejects.toThrow('must NOT have fewer than 1 items')
	})

	test('rejects a world without a name', async () => {
		const workDir = await mkdtemp(path.join(tmpdir(), 'datasworn-worlds-'))
		const sourceDir = path.join(workDir, 'source')
		await writeMinimalRuleset(sourceDir, 'fixture', {
			worlds: { forge: { truths: ['truth:fixture/origin'] } }
		})

		expect(
			buildRulesPackage({ id: 'fixture', type: 'ruleset', source: sourceDir })
		).rejects.toThrow("must have required property 'name'")
	})

	test('resolves world truths from a declared dependency', async () => {
		const workDir = await mkdtemp(path.join(tmpdir(), 'datasworn-worlds-'))
		const sourceDir = path.join(workDir, 'source')
		await writeMinimalRuleset(sourceDir, 'fixture', {
			worlds: {
				forge: { name: 'The Forge', truths: ['truth:base/origin'] }
			}
		})
		const dependency = {
			_id: 'base',
			truths: { origin: { _id: 'truth:base/origin' } }
		} as unknown as Datasworn.RulesPackage

		const result = await buildRulesPackage(
			{
				id: 'fixture',
				type: 'ruleset',
				source: sourceDir,
				outDir: path.join(workDir, 'out')
			},
			{ dependencies: [dependency] }
		)

		expect(result.idRefs.valid).toContain('truth:base/origin')
	})

	test('rejects an unresolved world truth reference', async () => {
		const workDir = await mkdtemp(path.join(tmpdir(), 'datasworn-worlds-'))
		const sourceDir = path.join(workDir, 'source')
		await writeMinimalRuleset(sourceDir, 'fixture', {
			worlds: {
				forge: { name: 'The Forge', truths: ['truth:fixture/missing'] }
			}
		})

		expect(
			buildRulesPackage({ id: 'fixture', type: 'ruleset', source: sourceDir })
		).rejects.toThrow('truth:fixture/missing')
	})

	test('rejects a source package ID that differs from the build config', async () => {
		const workDir = await mkdtemp(path.join(tmpdir(), 'datasworn-build-'))
		const sourceDir = path.join(workDir, 'source')
		await writeMinimalRuleset(sourceDir, 'source_id')

		await expect(
			buildRulesPackage({
				id: 'config_id',
				type: 'ruleset',
				source: sourceDir,
				outDir: path.join(workDir, 'out')
			})
		).rejects.toThrow(
			'package _id source_id does not match configured id config_id'
		)
	})

	test('rejects a source package type that differs from the build config', async () => {
		const workDir = await mkdtemp(path.join(tmpdir(), 'datasworn-build-'))
		const sourceDir = path.join(workDir, 'source')
		await writeMinimalExpansion(sourceDir, 'fixture', 'base')

		await expect(
			buildRulesPackage({
				id: 'fixture',
				type: 'ruleset',
				source: sourceDir,
				outDir: path.join(workDir, 'out')
			})
		).rejects.toThrow(
			'package type expansion does not match configured type ruleset'
		)
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

const sourceInfo = {
	title: 'Fixture',
	authors: [{ name: 'Datasworn Community' }],
	date: '2026-01-01',
	url: 'https://example.com',
	license: 'https://opensource.org/licenses/MIT'
}

function inMemoryRuleset(
	extra: Record<string, unknown> = {}
): DataswornSource.RulesPackage {
	return {
		_id: 'fixture',
		type: 'ruleset',
		datasworn_version: DATASWORN_SCHEMA_VERSION,
		...sourceInfo,
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
	} as DataswornSource.RulesPackage
}

async function writeMinimalExpansion(
	sourceDir: string,
	id: string,
	ruleset: string
) {
	await mkdir(sourceDir, { recursive: true })
	await writeFile(
		path.join(sourceDir, 'expansion.json'),
		`${JSON.stringify({
			_id: id,
			type: 'expansion',
			ruleset,
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
			truths: {}
		})}\n`
	)
}

describe('buildContentPackages', () => {
	test('rejects a config ID that is not a Datasworn package ID', async () => {
		const workDir = await mkdtemp(path.join(tmpdir(), 'datasworn-content-'))
		const sourceDir = path.join(workDir, 'source', 'base')
		await writeMinimalRuleset(sourceDir, 'base')

		await expect(
			buildContentPackages({
				outDir: path.join(workDir, 'datasworn'),
				packageOutDir: path.join(workDir, 'packages'),
				repository,
				packages: [
					{
						id: 'base-invalid',
						type: 'ruleset',
						source: sourceDir,
						packageName: '@datasworn-community/base',
						schemaLine
					}
				]
			})
		).rejects.toThrow(
			'base-invalid: package ID must match /^[a-z][a-z0-9_]*$/'
		)
	})

	test('generates typed ruleset exports using the Datasworn package ID', async () => {
		const workDir = await mkdtemp(path.join(tmpdir(), 'datasworn-content-'))
		const sourceDir = path.join(workDir, 'source', 'base')
		const packageOutDir = path.join(workDir, 'packages')
		await writeMinimalRuleset(sourceDir, 'base')

		await buildContentPackages({
			outDir: path.join(workDir, 'datasworn'),
			packageOutDir,
			repository,
			packages: [
				{
					id: 'base',
					type: 'ruleset',
					source: sourceDir,
					packageName: '@datasworn-community/base',
					schemaLine
				}
			]
		})

		const packageDir = path.join(packageOutDir, 'base')
		expect({
			indexJs: await readFile(path.join(packageDir, 'index.js'), 'utf8'),
			declaration: await readFile(path.join(packageDir, 'index.d.ts'), 'utf8')
		}).toEqual({
			indexJs:
				"import data from './json/base.json' with { type: 'json' }\n\nexport { data, data as base }\nexport default data\n",
			declaration:
				"import type { Datasworn } from '@datasworn-community/core'\n\ndeclare const data: Datasworn.Ruleset\nexport { data, data as base }\nexport default data\n"
		})
	})

	test('generates typed expansion exports using the Datasworn package ID', async () => {
		const workDir = await mkdtemp(path.join(tmpdir(), 'datasworn-content-'))
		const baseSource = path.join(workDir, 'source', 'base')
		const expansionSource = path.join(workDir, 'source', 'sundered_isles')
		const packageOutDir = path.join(workDir, 'packages')
		await writeMinimalRuleset(baseSource, 'base')
		await writeMinimalExpansion(expansionSource, 'sundered_isles', 'base')

		await buildContentPackages({
			outDir: path.join(workDir, 'datasworn'),
			packageOutDir,
			repository,
			packages: [
				{
					id: 'base',
					type: 'ruleset',
					source: baseSource,
					packageName: '@datasworn-community/base',
					schemaLine
				},
				{
					id: 'sundered_isles',
					type: 'expansion',
					source: expansionSource,
					packageName: '@datasworn-community/sundered-isles',
					schemaLine,
					dependencies: ['base']
				}
			]
		})

		const packageDir = path.join(packageOutDir, 'sundered_isles')
		expect({
			indexJs: await readFile(path.join(packageDir, 'index.js'), 'utf8'),
			declaration: await readFile(path.join(packageDir, 'index.d.ts'), 'utf8')
		}).toEqual({
			indexJs:
				"import data from './json/sundered_isles.json' with { type: 'json' }\n\nexport { data, data as sundered_isles }\nexport default data\n",
			declaration:
				"import type { Datasworn } from '@datasworn-community/core'\n\ndeclare const data: Datasworn.Expansion\nexport { data, data as sundered_isles }\nexport default data\n"
		})
	})

	test('builds packages in dependency order and writes publishable artifacts', async () => {
		const workDir = await mkdtemp(path.join(tmpdir(), 'datasworn-content-'))
		const baseSource = path.join(workDir, 'source', 'base')
		const expansionSource = path.join(workDir, 'source', 'expansion')
		const assetSource = path.join(workDir, 'assets', 'icons')
		const migrationSource = path.join(workDir, 'migration', 'expansion')
		const outDir = path.join(workDir, 'datasworn')
		const publicJsonOutDir = path.join(workDir, 'generated-datasworn')
		const packageOutDir = path.join(workDir, 'packages')
		await writeMinimalRuleset(baseSource, 'base')
		await writeMinimalRuleset(expansionSource, 'expansion')
		await mkdir(assetSource, { recursive: true })
		await mkdir(path.join(migrationSource, '0.1.0'), { recursive: true })
		await writeFile(path.join(assetSource, 'icon.svg'), '<svg />\n')
		await writeFile(
			path.join(migrationSource, '0.1.0', 'id_map.json'),
			'{"old/id":"new:id"}\n'
		)

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
					assets: [assetSource],
					migration: [migrationSource]
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
		const expansionMigrationMap = await readFile(
			path.join(
				packageOutDir,
				'expansion',
				'migration',
				'0.1.0',
				'id_map.json'
			),
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
		expect(expansionPackage.files).toContain('migration')
		expect(expansionPackage.exports).toMatchObject({
			'./icons/*': './icons/*',
			'./migration/*': './migration/*'
		})
		expect(expansionPackage.repository).toEqual(repository)
		expect(expansionIndex).toContain("./json/expansion.json")
		expect(expansionAsset).toBe('<svg />\n')
		expect(expansionMigrationMap).toBe('{"old/id":"new:id"}\n')
		expect(generatedExpansion._id).toBe('expansion')
		expect(generatedManifest.datasworn_version).toBe(DATASWORN_SCHEMA_VERSION)
		expect(Object.keys(generatedManifest.packages)).toEqual(['base', 'expansion'])
		expect(generatedManifest.packages.expansion).toMatchObject({
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
