import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

import {
	DATASWORN_SCHEMA_VERSION,
	IdElements,
	type Datasworn
} from '@datasworn-community/core'

import {
	buildRulesPackage,
	type RulesPackageBuildConfig,
	type RulesPackageBuildResult
} from './rules-package-builder.js'
import { validateIdRefs } from '../id-references.js'

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
	repository: PackageRepository
	license?: string
	private?: boolean
}

export interface PackageRepository {
	type: string
	url: string
	directory?: string
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
	/**
	 * Additional packages to load for ID-reference validation without declaring
	 * them as publish-time package dependencies.
	 */
	validationDependencies?: ContentPackageDependencyConfig[]
	/**
	 * Asset directories to copy into the generated publishable package, for
	 * example `source_data/starforged/icons`.
	 */
	assets?: string[]
	/**
	 * Migration artifact directories to copy into the generated publishable
	 * package, for example `source_data/starforged/migration`.
	 */
	migration?: string[]
	paths?: RulesPackageBuildConfig['paths'] & {
		assets?: string[]
		migration?: string[]
	}
}

export interface MultiPackageBuildConfig {
	outDir?: string
	/**
	 * Optional checked-in raw JSON output for GitHub users. Files are written
	 * flat as `<package-id>.json` plus a manifest.
	 */
	publicJsonOutDir?: string
	packageOutDir?: string
	repository: PackageRepository
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

interface GeneratedJsonManifest {
	datasworn_version: string
	packages: Record<string, GeneratedJsonManifestPackage>
}

interface GeneratedJsonManifestPackage {
	id: string
	type: Datasworn.RulesPackage['type']
	schemaLine: string
	packageName: string
	path: string
	description?: string
	license?: string
	dependencies?: string[]
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

function assertPackageIds(packages: readonly ContentPackageBuildConfig[]): void {
	for (const config of packages) {
		if (!IdElements.TypeGuard.RulesPackageId(config.id))
			throw new Error(
				`${config.id}: package ID must match ${IdElements.Pattern.RulesPackageId.toString()}`
			)
	}
}

function assertPackageRepository(
	repository: PackageRepository | undefined
): asserts repository is PackageRepository {
	if (repository == null)
		throw new Error('Multi-package content build config requires repository')

	if (typeof repository.type !== 'string' || repository.type.length === 0)
		throw new Error('Multi-package content build config repository.type is required')

	if (typeof repository.url !== 'string' || repository.url.length === 0)
		throw new Error('Multi-package content build config repository.url is required')

	if (
		repository.directory != null &&
		typeof repository.directory !== 'string'
	)
		throw new Error('Multi-package content build config repository.directory must be a string')
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

async function validationDependencyMetadata(
	config: ContentPackageBuildConfig,
	builtPackages: BuiltPackageMap
): Promise<ContentPackageDependencyConfig[]> {
	const publish = dependencyMetadata(config, builtPackages)
	const byId = new Map(publish.map((dependency) => [dependency.id, dependency]))

	for (const dependency of config.validationDependencies ?? [])
		byId.set(dependency.id, dependency)

	return [...byId.values()]
}

async function preloadedDependencies(
	config: ContentPackageBuildConfig,
	builtPackages: BuiltPackageMap
): Promise<Datasworn.RulesPackage[]> {
	const dependencies: Datasworn.RulesPackage[] = []

	for (const dependency of await validationDependencyMetadata(config, builtPackages)) {
		const built = builtPackages.get(dependency.id)
		dependencies.push(
			built?.data ?? (await loadInstalledDependency(dependency))
		)
	}

	return dependencies
}

function assetDirs(config: ContentPackageBuildConfig): string[] {
	return config.assets ?? config.paths?.assets ?? []
}

function migrationDirs(config: ContentPackageBuildConfig): string[] {
	return config.migration ?? config.paths?.migration ?? []
}

function packageJsonFor(
	config: ContentPackageBuildConfig,
	dependencies: readonly ContentPackageDependencyConfig[],
	repository: PackageRepository
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
		repository: { ...repository },
		license: config.license,
		private: config.private
	}
}

function stableJson(value: unknown): string {
	return `${JSON.stringify(value, undefined, 2)}\n`
}

function generatedManifest(
	results: readonly ContentPackageBuildResult[]
): GeneratedJsonManifest {
	const packages = Object.fromEntries(
		results
			.map((result) => [
				result.config.id,
				{
					id: result.config.id,
					type: result.config.type,
					schemaLine: result.config.schemaLine,
					packageName: result.config.packageName,
					path: `${result.config.id}.json`,
					description: result.config.description,
					license: result.config.license,
					dependencies: result.config.dependencies
				}
			] satisfies [string, GeneratedJsonManifestPackage])
			.sort(([left], [right]) => left.localeCompare(right, 'en-US'))
	)

	return {
		datasworn_version: DATASWORN_SCHEMA_VERSION,
		packages
	}
}

function generatedReadme(): string {
	return `# Generated Datasworn JSON

This directory contains generated raw Datasworn JSON files for direct use from
GitHub.

Do not edit these files by hand. Edit source data, rebuild the project, and
commit the regenerated output.

\`manifest.json\` lists the current generated file and package metadata for each
content package.
`
}

async function writeGeneratedJsonArtifacts(
	results: readonly ContentPackageBuildResult[],
	publicJsonOutDir: string
): Promise<void> {
	await rm(publicJsonOutDir, { recursive: true, force: true })
	await mkdir(publicJsonOutDir, { recursive: true })

	await Promise.all([
		writeFile(path.join(publicJsonOutDir, 'README.md'), generatedReadme()),
		writeFile(
			path.join(publicJsonOutDir, 'manifest.json'),
			stableJson(generatedManifest(results))
		),
		...results.map(async (result) => {
			const json = await readFile(result.outFile, 'utf8')
			await writeFile(path.join(publicJsonOutDir, `${result.config.id}.json`), json)
		})
	])
}

async function copyPackageAssets(
	config: ContentPackageBuildConfig,
	packageDir: string,
	packageJson: PackageJson
): Promise<void> {
	for (const source of assetDirs(config)) {
		const targetName = path.basename(source)
		const target = path.join(packageDir, targetName)

		await cp(source, target, {
			recursive: true,
			force: true,
			filter: (entryPath) => path.basename(entryPath) !== '.DS_Store'
		})

		if (!packageJson.files.includes(targetName)) packageJson.files.push(targetName)
		packageJson.exports[`./${targetName}/*`] = `./${targetName}/*`
	}

	packageJson.files.sort((left, right) => left.localeCompare(right, 'en-US'))
}

async function copyPackageMigrationArtifacts(
	config: ContentPackageBuildConfig,
	packageDir: string,
	packageJson: PackageJson
): Promise<void> {
	const sources = migrationDirs(config)
	if (sources.length === 0) return

	const target = path.join(packageDir, 'migration')
	for (const source of sources) {
		await cp(source, target, {
			recursive: true,
			force: true,
			filter: (entryPath) => path.basename(entryPath) !== '.DS_Store'
		})
	}

	if (!packageJson.files.includes('migration')) packageJson.files.push('migration')
	packageJson.exports['./migration/*'] = './migration/*'
	packageJson.files.sort((left, right) => left.localeCompare(right, 'en-US'))
}

async function writePublishableArtifacts(
	config: ContentPackageBuildConfig,
	result: RulesPackageBuildResult,
	builtPackages: BuiltPackageMap,
	packageOutDir: string,
	repository: PackageRepository
): Promise<ContentPackageBuildResult> {
	const dependencies = dependencyMetadata(config, builtPackages)
	const packageJson = packageJsonFor(config, dependencies, repository)
	const packageDir = path.join(packageOutDir, config.id)
	const jsonDir = path.join(packageDir, 'json')
	const packageType = config.type === 'ruleset' ? 'Ruleset' : 'Expansion'
	const namedExports =
		config.id === 'data' || config.id === 'default'
			? 'export { data }'
			: `export { data, data as ${config.id} }`

	await mkdir(jsonDir, { recursive: true })
	await copyPackageAssets(config, packageDir, packageJson)
	await copyPackageMigrationArtifacts(config, packageDir, packageJson)
	await Promise.all([
		writeFile(path.join(packageDir, 'package.json'), stableJson(packageJson)),
		writeFile(
			path.join(packageDir, 'index.js'),
			`import data from './json/${config.id}.json' with { type: 'json' }\n\n${namedExports}\nexport default data\n`
		),
		writeFile(
			path.join(packageDir, 'index.d.ts'),
			`import type { Datasworn } from '@datasworn-community/core'\n\ndeclare const data: Datasworn.${packageType}\n${namedExports}\nexport default data\n`
		),
		writeFile(path.join(jsonDir, `${config.id}.json`), stableJson(result.data))
	])

	return { ...result, config, packageDir, packageJson }
}

export async function buildContentPackages(
	config: MultiPackageBuildConfig
): Promise<MultiPackageBuildResult> {
	assertPackageRepository(config.repository)
	const outDir = config.outDir ?? 'datasworn'
	const publicJsonOutDir = config.publicJsonOutDir
	const packageOutDir = config.packageOutDir ?? 'dist/packages'
	assertPackageIds(config.packages)
	const ordered = topologicalPackageOrder(config.packages)
	const builtPackages: BuiltPackageMap = new Map()
	const results: ContentPackageBuildResult[] = []
	const validationTree: Record<string, Datasworn.RulesPackage> = {}

	for (const packageConfig of ordered) {
		assertSchemaLine(packageConfig)
		const result = await buildRulesPackage(packageConfig, {
			outDir,
			validateIdRefs: false
		})
		validationTree[packageConfig.id] = result.data
		const publishable = await writePublishableArtifacts(
			packageConfig,
			result,
			builtPackages,
			packageOutDir,
			config.repository
		)
		builtPackages.set(packageConfig.id, publishable)
		results.push(publishable)
	}

	for (const result of results) {
		const dependencyTree: Record<string, Datasworn.RulesPackage> = {
			...validationTree
		}
		for (const dependency of await preloadedDependencies(result.config, builtPackages))
			dependencyTree[dependency._id] = dependency

		const idRefs = validateIdRefs(result.data, dependencyTree)
		const unresolved = [...idRefs.invalid, ...idRefs.unreachable]
		if (unresolved.length > 0)
			throw new Error(
				`${result.config.id}: ${unresolved.length} unresolved ID reference(s):\n  ${unresolved.join('\n  ')}`
			)
	}

	if (publicJsonOutDir != null)
		await writeGeneratedJsonArtifacts(results, publicJsonOutDir)

	return {
		results,
		buildOrder: ordered.map((packageConfig) => packageConfig.id)
	}
}
