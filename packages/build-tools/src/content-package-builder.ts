import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

import { DATASWORN_SCHEMA_VERSION, type Datasworn } from '@datasworn-community/core'

import {
	buildRulesPackage,
	type RulesPackageBuildConfig,
	type RulesPackageBuildResult
} from './rules-package-builder.js'

const require = createRequire(import.meta.url)

interface PackageJson {
	name: string
	version: string
	description?: string
	type: 'module'
	main: string
	types: string
	exports: Record<string, unknown>
	files: string[]
	dependencies: Record<string, string>
	license?: string
	private?: boolean
}

export interface ContentPackageDependencyConfig {
	/** Rules package ID referenced by this package. */
	id: string
	/** Published npm package name for dependency metadata and installed preload. */
	packageName: string
	/** Schema line accepted by this package, for example `0.2`. */
	schemaLine: string
}

export interface ContentPackageBuildConfig extends RulesPackageBuildConfig {
	/** Published npm package name, for example `@datasworn-community/starforged`. */
	packageName: string
	/** Schema line this dataset targets, for example `0.2`. */
	schemaLine: string
	/** Full package version. Release workflows normally fill this in. */
	version?: string
	description?: string
	license?: string
	private?: boolean
	/** Cross-package Datasworn package dependencies. */
	dependencies?: string[]
	/** Metadata for dependencies that may be published as sibling packages. */
	publishDependencies?: ContentPackageDependencyConfig[]
}

export interface MultiPackageBuildConfig {
	outDir?: string
	packageOutDir?: string
	packages: ContentPackageBuildConfig[]
}

export interface ContentPackageBuildResult extends RulesPackageBuildResult {
	config: ContentPackageBuildConfig
	packageDir: string
	packageJson: PackageJson
}

export interface MultiPackageBuildResult {
	results: ContentPackageBuildResult[]
	buildOrder: string[]
}

type BuiltPackageMap = Map<string, ContentPackageBuildResult>

function currentSchemaLine(): string {
	const [major, minor] = DATASWORN_SCHEMA_VERSION.split('.')
	return `${major}.${minor}`
}

function dependencyRange(schemaLine: string): string {
	return `^${schemaLine}.0`
}

function packageVersion(config: ContentPackageBuildConfig): string {
	return config.version ?? `${config.schemaLine}.0`
}

function assertSchemaLine(config: ContentPackageBuildConfig): void {
	if (!/^\d+\.\d+$/.test(config.schemaLine))
		throw new Error(`${config.id}: schemaLine must look like "0.2"`)

	const activeSchemaLine = currentSchemaLine()
	if (config.schemaLine !== activeSchemaLine)
		throw new Error(
			`${config.id}: schemaLine ${config.schemaLine} does not match installed core schema line ${activeSchemaLine}`
		)

	const version = packageVersion(config)
	if (!version.startsWith(`${config.schemaLine}.`))
		throw new Error(
			`${config.id}: package version ${version} must stay on schema line ${config.schemaLine}`
		)
}

function assertNoDuplicatePackageIds(packages: readonly ContentPackageBuildConfig[]) {
	const seen = new Set<string>()
	for (const config of packages) {
		if (seen.has(config.id)) throw new Error(`Duplicate package id: ${config.id}`)
		seen.add(config.id)
	}
}

function topologicalPackageOrder(
	packages: readonly ContentPackageBuildConfig[]
): ContentPackageBuildConfig[] {
	assertNoDuplicatePackageIds(packages)
	const byId = new Map(packages.map((config) => [config.id, config]))
	const visiting = new Set<string>()
	const visited = new Set<string>()
	const ordered: ContentPackageBuildConfig[] = []

	function visit(config: ContentPackageBuildConfig, ancestry: string[]): void {
		if (visited.has(config.id)) return
		if (visiting.has(config.id))
			throw new Error(`Circular package dependency: ${[...ancestry, config.id].join(' -> ')}`)

		visiting.add(config.id)
		for (const dependencyId of config.dependencies ?? []) {
			const dependency = byId.get(dependencyId)
			if (dependency != null) visit(dependency, [...ancestry, config.id])
		}
		visiting.delete(config.id)
		visited.add(config.id)
		ordered.push(config)
	}

	for (const config of packages) visit(config, [])
	return ordered
}

function dependencyMetadata(
	config: ContentPackageBuildConfig,
	builtPackages: BuiltPackageMap
): ContentPackageDependencyConfig[] {
	const explicit = new Map(
		(config.publishDependencies ?? []).map((dependency) => [
			dependency.id,
			dependency
		])
	)

	return (config.dependencies ?? []).map((dependencyId) => {
		const built = builtPackages.get(dependencyId)
		if (built != null)
			return {
				id: dependencyId,
				packageName: built.config.packageName,
				schemaLine: built.config.schemaLine
			}

		const dependency = explicit.get(dependencyId)
		if (dependency == null)
			throw new Error(
				`${config.id}: dependency ${dependencyId} is neither built in this repo nor listed in publishDependencies`
			)
		return dependency
	})
}

async function loadInstalledDependency(
	dependency: ContentPackageDependencyConfig
): Promise<Datasworn.RulesPackage> {
	const jsonPath = require.resolve(
		`${dependency.packageName}/json/${dependency.id}.json`,
		{ paths: [process.cwd()] }
	)
	return JSON.parse(await readFile(jsonPath, 'utf8')) as Datasworn.RulesPackage
}

async function preloadedDependencies(
	config: ContentPackageBuildConfig,
	builtPackages: BuiltPackageMap
): Promise<Datasworn.RulesPackage[]> {
	const dependencies: Datasworn.RulesPackage[] = []

	for (const dependency of dependencyMetadata(config, builtPackages)) {
		const built = builtPackages.get(dependency.id)
		dependencies.push(
			built?.data ?? (await loadInstalledDependency(dependency))
		)
	}

	return dependencies
}

function packageJsonFor(
	config: ContentPackageBuildConfig,
	dependencies: readonly ContentPackageDependencyConfig[]
): PackageJson {
	const packageDependencies = Object.fromEntries(
		[
			['@datasworn-community/core', dependencyRange(config.schemaLine)],
			...dependencies.map((dependency) => [
				dependency.packageName,
				dependencyRange(dependency.schemaLine)
			])
		].sort(([left], [right]) => left.localeCompare(right, 'en-US'))
	)

	return {
		name: config.packageName,
		version: packageVersion(config),
		description: config.description,
		type: 'module',
		main: './index.js',
		types: './index.d.ts',
		exports: {
			'.': {
				types: './index.d.ts',
				default: './index.js'
			},
			'./json/*': './json/*',
			'./package.json': './package.json'
		},
		files: ['index.js', 'index.d.ts', 'json'],
		dependencies: packageDependencies,
		license: config.license,
		private: config.private
	}
}

function stableJson(value: unknown): string {
	return `${JSON.stringify(value, undefined, 2)}\n`
}

async function writePublishableArtifacts(
	config: ContentPackageBuildConfig,
	result: RulesPackageBuildResult,
	builtPackages: BuiltPackageMap,
	packageOutDir: string
): Promise<ContentPackageBuildResult> {
	const dependencies = dependencyMetadata(config, builtPackages)
	const packageJson = packageJsonFor(config, dependencies)
	const packageDir = path.join(packageOutDir, config.id)
	const jsonDir = path.join(packageDir, 'json')

	await mkdir(jsonDir, { recursive: true })
	await Promise.all([
		writeFile(path.join(packageDir, 'package.json'), stableJson(packageJson)),
		writeFile(
			path.join(packageDir, 'index.js'),
			`import data from './json/${config.id}.json' with { type: 'json' }\n\nexport { data }\nexport default data\n`
		),
		writeFile(
			path.join(packageDir, 'index.d.ts'),
			"import type { Datasworn } from '@datasworn-community/core'\n\ndeclare const data: Datasworn.RulesPackage\nexport { data }\nexport default data\n"
		),
		writeFile(path.join(jsonDir, `${config.id}.json`), stableJson(result.data))
	])

	return { ...result, config, packageDir, packageJson }
}

export async function buildContentPackages(
	config: MultiPackageBuildConfig
): Promise<MultiPackageBuildResult> {
	const outDir = config.outDir ?? 'datasworn'
	const packageOutDir = config.packageOutDir ?? 'dist/packages'
	const ordered = topologicalPackageOrder(config.packages)
	const builtPackages: BuiltPackageMap = new Map()
	const results: ContentPackageBuildResult[] = []

	for (const packageConfig of ordered) {
		assertSchemaLine(packageConfig)
		const dependencies = await preloadedDependencies(packageConfig, builtPackages)
		const result = await buildRulesPackage(packageConfig, {
			outDir,
			dependencies
		})
		const publishable = await writePublishableArtifacts(
			packageConfig,
			result,
			builtPackages,
			packageOutDir
		)
		builtPackages.set(packageConfig.id, publishable)
		results.push(publishable)
	}

	return {
		results,
		buildOrder: ordered.map((packageConfig) => packageConfig.id)
	}
}
