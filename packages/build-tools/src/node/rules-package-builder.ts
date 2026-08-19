import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
	DATASWORN_SCHEMA_VERSION,
	type Datasworn,
	type DataswornSource
} from '@datasworn-community/core'
import YAML from 'yaml'

import {
	assembleRulesPackage,
	type NamedRulesPackageSource
} from '../in-memory-rules-package-builder.js'
import {
	validateIdRefs,
	type IdRefReport
} from '../id-references.js'
import type { DataswornValidators } from '../validators.js'
import { createDataswornValidators } from './validators.js'

export interface RulesPackageBuildConfig {
	id: string
	type: Datasworn.RulesPackage['type']
	source?: string
	outDir?: string
	paths?: {
		source: string
	}
	/**
	 * IDs of other rules packages this one references (e.g. an expansion's
	 * ruleset). The multi-package builder preloads their built output so
	 * cross-package ID references resolve; declaration order does not matter.
	 */
	dependencies?: string[]
}

export interface BuildRulesPackageOptions {
	outDir?: string
	validators?: DataswornValidators<
		Datasworn.RulesPackage,
		DataswornSource.RulesPackage
	>
	/**
	 * Already-built dependency packages to include in the ID-reference
	 * validation tree, so references from this package into them resolve.
	 */
	dependencies?: readonly Datasworn.RulesPackage[]
	/**
	 * Validate ID references immediately against this package and dependencies.
	 * Multi-package content builds disable this and validate once against the
	 * complete in-repo tree, which supports optional cross-package references.
	 */
	validateIdRefs?: boolean
}

export interface RulesPackageBuildResult {
	data: Datasworn.RulesPackage
	files: string[]
	outFile: string
	/** Result of validating this package's ID references against the tree. */
	idRefs: IdRefReport
}

type JsonObject = Record<string, unknown>

const sourceExtensions = new Set(['.json', '.yaml', '.yml'])

function isObject(value: unknown): value is JsonObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cloneJsonValue<TValue>(value: TValue): TValue {
	return JSON.parse(JSON.stringify(value)) as TValue
}

function sortValue(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortValue)
	if (!isObject(value)) return value

	return Object.fromEntries(
		Object.entries(value)
			.sort(([left], [right]) => left.localeCompare(right, 'en-US'))
			.map(([key, entryValue]) => [key, sortValue(entryValue)])
	)
}

async function collectSourceFiles(sourceDir: string): Promise<string[]> {
	const entries = await readdir(sourceDir, { recursive: true, withFileTypes: true })
	const files = entries
		.filter((entry) => entry.isFile())
		.map((entry) => path.join(entry.parentPath, entry.name))
		.filter((filePath) => sourceExtensions.has(path.extname(filePath)))
		.sort((left, right) => left.localeCompare(right, 'en-US'))

	if (files.length === 0)
		throw new Error(`No Datasworn source files found in ${sourceDir}`)

	return files
}

async function readSourceFile(
	filePath: string
): Promise<DataswornSource.RulesPackage> {
	const text = await readFile(filePath, 'utf8')
	const ext = path.extname(filePath)
	const value =
		ext === '.json'
			? JSON.parse(text)
			: cloneJsonValue(YAML.parse(text, { maxAliasCount: -1, merge: true }))

	if (!isObject(value)) throw new Error(`${filePath} did not parse to an object`)
	value.datasworn_version = DATASWORN_SCHEMA_VERSION

	return value as unknown as DataswornSource.RulesPackage
}

function normalizeConfig(config: RulesPackageBuildConfig) {
	const source = config.source ?? config.paths?.source
	if (source == null) throw new Error('Rules package build config requires source')

	return { ...config, source }
}

export async function buildRulesPackage(
	config: RulesPackageBuildConfig,
	options: BuildRulesPackageOptions = {}
): Promise<RulesPackageBuildResult> {
	const normalizedConfig = normalizeConfig(config)
	const validators =
		options.validators ??
		(await createDataswornValidators<
			Datasworn.RulesPackage,
			DataswornSource.RulesPackage
		>())
	const outDir = options.outDir ?? normalizedConfig.outDir ?? 'datasworn'
	const files = await collectSourceFiles(normalizedConfig.source)
	const sources: NamedRulesPackageSource[] = []
	for (const filePath of files) {
		const source = await readSourceFile(filePath)
		sources.push({ name: filePath, data: source })
	}

	const { data } = assembleRulesPackage(sources, validators, {
		id: normalizedConfig.id,
		type: normalizedConfig.type
	})

	// Validate ID references against a tree of this package plus any preloaded
	// dependencies. This catches cross-package references (e.g. an expansion
	// pointing at its ruleset) that AJV structural validation cannot.
	const tree: Record<string, Datasworn.RulesPackage> = {
		[normalizedConfig.id]: data
	}
	for (const dependency of options.dependencies ?? [])
		tree[dependency._id] = dependency

	const shouldValidateIdRefs = options.validateIdRefs ?? true
	const idRefs = shouldValidateIdRefs
		? validateIdRefs(data, tree)
		: { valid: new Set<string>(), invalid: new Set<string>(), unreachable: new Set<string>() }
	const unresolved = [...idRefs.invalid, ...idRefs.unreachable]
	if (shouldValidateIdRefs && unresolved.length > 0)
		throw new Error(
			`${normalizedConfig.id}: ${unresolved.length} unresolved ID reference(s):\n  ${unresolved.join('\n  ')}`
		)

	const packageOutDir = path.join(outDir, normalizedConfig.id)
	const outFile = path.join(packageOutDir, `${normalizedConfig.id}.json`)
	await mkdir(packageOutDir, { recursive: true })
	await writeFile(outFile, `${JSON.stringify(sortValue(data), undefined, 2)}\n`)

	return { data, files, outFile, idRefs }
}
