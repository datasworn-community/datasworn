import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { DATASWORN_SCHEMA_VERSION } from '@datasworn-community/core'
import {
	buildRulesPackage,
	loadCoreSchema,
	resolveCoreSchemaPath
} from '@datasworn-community/build-tools'

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
