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
})

async function writeMinimalRuleset(sourceDir: string, id: string) {
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
			}
		})}\n`
	)
}

describe('buildContentPackages', () => {
	test('builds packages in dependency order and writes publishable artifacts', async () => {
		const workDir = await mkdtemp(path.join(tmpdir(), 'datasworn-content-'))
		const baseSource = path.join(workDir, 'source', 'base')
		const expansionSource = path.join(workDir, 'source', 'expansion')
		const outDir = path.join(workDir, 'datasworn')
		const packageOutDir = path.join(workDir, 'packages')
		await writeMinimalRuleset(baseSource, 'base')
		await writeMinimalRuleset(expansionSource, 'expansion')

		const result = await buildContentPackages({
			outDir,
			packageOutDir,
			packages: [
				{
					id: 'expansion',
					type: 'ruleset',
					source: expansionSource,
					packageName: '@datasworn-community/expansion',
					schemaLine,
					version: `${schemaLine}.4`,
					dependencies: ['base']
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
		}
		const expansionIndex = await readFile(
			path.join(packageOutDir, 'expansion', 'index.js'),
			'utf8'
		)

		expect(expansionPackage.version).toBe(`${schemaLine}.4`)
		expect(expansionPackage.dependencies).toMatchObject({
			'@datasworn-community/base': `^${schemaLine}.0`,
			'@datasworn-community/core': `^${schemaLine}.0`
		})
		expect(expansionIndex).toContain("./json/expansion.json")
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
