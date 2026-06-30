import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import {
	DATASWORN_SCHEMA_VERSION,
	DataswornTree,
	IdParser,
	type Datasworn,
	type PrimaryStringId
} from '@datasworn-community/core'
import type * as Core from '@datasworn-community/core'

const root = path.resolve(import.meta.dir, '..')
const require = createRequire(import.meta.url)

describe('@datasworn-community/core', () => {
	test('parses and formats primary Datasworn IDs', () => {
		const id = IdParser.parse('move:starforged/combat/strike')

		expect(id.toString()).toBe('move:starforged/combat/strike')
		expect(id.typeId).toBe('move')
		expect(id.rulesPackageId).toBe('starforged')
		expect(id.pathSegments).toEqual(['starforged/combat/strike'])
	})

	test('exports StringId primary types from the package root', () => {
		const moveId: PrimaryStringId = 'move:starforged/combat/strike'

		expect(moveId).toBe('move:starforged/combat/strike')
	})

	test('exports the Datasworn schema version separately from package version', () => {
		expect(DATASWORN_SCHEMA_VERSION).toBe('0.2.0')
	})

	test('indexes rules packages by ID', () => {
		const rulesPackage = {
			_id: 'starforged',
			type: 'ruleset',
			datasworn_version: DATASWORN_SCHEMA_VERSION,
			title: 'Starforged',
			authors: [],
			date: '2026-01-01',
			url: 'https://example.com',
			license: 'MIT',
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
		} satisfies Datasworn.Ruleset

		const tree = new DataswornTree(rulesPackage)

		expect(tree.get('starforged')).toBe(rulesPackage)
	})

	test('builds import and require entrypoints', async () => {
		const esmMarker = path.join(root, 'packages/core/dist/esm/package.json')
		const cjsMarker = path.join(root, 'packages/core/dist/cjs/package.json')

		expect(existsSync(esmMarker)).toBe(true)
		expect(existsSync(cjsMarker)).toBe(true)
		expect(JSON.parse(readFileSync(esmMarker, 'utf8'))).toEqual({
			type: 'module'
		})
		expect(JSON.parse(readFileSync(cjsMarker, 'utf8'))).toEqual({
			type: 'commonjs'
		})

		const esm = (await import(
			pathToFileURL(path.join(root, 'packages/core/dist/esm/index.js')).href
		)) as typeof Core
		const cjs = require(
			path.join(root, 'packages/core/dist/cjs/index.js')
		) as typeof esm

		expect(esm.IdParser.parse('asset:starforged/path/veteran').toString()).toBe(
			'asset:starforged/path/veteran'
		)
		expect(cjs.IdParser.parse('asset:starforged/path/veteran').toString()).toBe(
			'asset:starforged/path/veteran'
		)
	})
})
