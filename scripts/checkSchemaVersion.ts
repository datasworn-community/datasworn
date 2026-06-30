import { execFile } from 'node:child_process'
import { access, readFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { DATASWORN_SCHEMA_VERSION } from '@datasworn-community/core'

type JsonObject = Record<string, unknown>

const execFileAsync = promisify(execFile)
const schemaPaths = [
	'packages/core/json/datasworn.schema.json',
	'packages/core/json/datasworn-source.schema.json'
]
const currentSchemas = new Map<string, JsonObject>()

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message)
}

function asObject(value: unknown, label: string): JsonObject {
	assert(
		typeof value === 'object' && value !== null && !Array.isArray(value),
		`${label} must be an object`
	)
	return value as JsonObject
}

function findVersionSchemas(value: unknown): JsonObject[] {
	if (Array.isArray(value)) return value.flatMap(findVersionSchemas)
	if (typeof value !== 'object' || value === null) return []

	const node = value as JsonObject
	const properties = node.properties
	const found: JsonObject[] = []

	if (
		typeof properties === 'object' &&
		properties !== null &&
		!Array.isArray(properties)
	) {
		const version = (properties as JsonObject).datasworn_version
		if (typeof version === 'object' && version !== null && !Array.isArray(version))
			found.push(version as JsonObject)
	}

	for (const child of Object.values(node)) found.push(...findVersionSchemas(child))

	return found
}

function getVersionLiterals(schema: JsonObject, schemaPath: string): string[] {
	const versionSchemas = findVersionSchemas(schema)

	assert(
		versionSchemas.length > 0,
		`${schemaPath} does not define any datasworn_version schema literals`
	)

	return versionSchemas.map((version) => {
		assert(
			typeof version.const === 'string',
			`${schemaPath} datasworn_version const must be a string`
		)
		return version.const
	})
}

function assertVersionLiterals(schema: JsonObject, schemaPath: string): string {
	for (const version of getVersionLiterals(schema, schemaPath))
		assert(
			version === DATASWORN_SCHEMA_VERSION,
			`${schemaPath} datasworn_version const ${version} does not match DATASWORN_SCHEMA_VERSION ${DATASWORN_SCHEMA_VERSION}`
		)

	return DATASWORN_SCHEMA_VERSION
}

function normalizeSchemaForVersionComparison(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(normalizeSchemaForVersionComparison)
	if (typeof value !== 'object' || value === null) return value

	const node = value as JsonObject
	const normalized: JsonObject = {}

	for (const [key, child] of Object.entries(node)) {
		if (key === 'title' && typeof child === 'string') {
			normalized[key] = child.replace(/\bv\d+\.\d+\.\d+(?:[-+][\w.-]+)?\b/, 'v<schema-version>')
			continue
		}

		normalized[key] = normalizeSchemaForVersionComparison(child)
	}

	const properties = normalized.properties
	if (
		typeof properties === 'object' &&
		properties !== null &&
		!Array.isArray(properties)
	) {
		const version = (properties as JsonObject).datasworn_version
		if (typeof version === 'object' && version !== null && !Array.isArray(version))
			(version as JsonObject).const = '<schema-version>'
	}

	return normalized
}

async function readGitFile(ref: string, filePath: string): Promise<string | null> {
	try {
		const { stdout } = await execFileAsync('git', ['show', `${ref}:${filePath}`])
		return stdout
	} catch (_error) {
		return null
	}
}

async function assertSchemaShapeChangesBumpVersion() {
	for (const schemaPath of schemaPaths) {
		const currentSchema = currentSchemas.get(schemaPath)
		assert(currentSchema != null, `${schemaPath} was not loaded`)

		const baseText =
			(await readGitFile('origin/main', schemaPath)) ??
			(await readGitFile('main', schemaPath))
		if (baseText == null) {
			console.warn(
				`Skipping schema bump comparison for ${schemaPath}: no base schema found on main`
			)
			continue
		}

		const baseSchema = asObject(JSON.parse(baseText), `${schemaPath} on main`)
		const currentShape = JSON.stringify(
			normalizeSchemaForVersionComparison(currentSchema)
		)
		const baseShape = JSON.stringify(normalizeSchemaForVersionComparison(baseSchema))
		if (currentShape === baseShape) continue

		const baseVersions = new Set(getVersionLiterals(baseSchema, `${schemaPath} on main`))
		assert(
			!baseVersions.has(DATASWORN_SCHEMA_VERSION),
			`${schemaPath} changed shape without bumping DATASWORN_SCHEMA_VERSION from ${DATASWORN_SCHEMA_VERSION}`
		)
	}
}

async function assertPackageVersionSurfaces() {
	const [corePackageText, buildToolsPackageText] = await Promise.all([
		readFile('packages/core/package.json', 'utf8'),
		readFile('packages/build-tools/package.json', 'utf8')
	])
	const corePackage = asObject(JSON.parse(corePackageText), 'core package.json')
	const buildToolsPackage = asObject(
		JSON.parse(buildToolsPackageText),
		'build-tools package.json'
	)
	const peerDependencies = asObject(
		buildToolsPackage.peerDependencies,
		'build-tools peerDependencies'
	)
	const corePeerRange = peerDependencies['@datasworn-community/core']

	assert(
		corePeerRange === corePackage.version,
		`build-tools core peer range ${String(corePeerRange)} does not match core package version ${String(corePackage.version)}`
	)

	await access(`packages/core/migration/${DATASWORN_SCHEMA_VERSION}`)
}

function assertGeneratedTypesUseVersion(fileText: string, filePath: string) {
	const expected = `datasworn_version: "${DATASWORN_SCHEMA_VERSION}";`
	assert(
		fileText.includes(expected),
		`${filePath} does not include generated schema version literal ${expected}`
	)
}

for (const schemaPath of schemaPaths) {
	const schema = asObject(
		JSON.parse(await readFile(schemaPath, 'utf8')),
		schemaPath
	)
	currentSchemas.set(schemaPath, schema)
	const version = assertVersionLiterals(schema, schemaPath)
	assert(
		typeof schema.title === 'string' && schema.title.includes(version),
		`${schemaPath} title does not include schema version ${version}`
	)
}

await Promise.all([
	readFile('packages/core/src/Datasworn.ts', 'utf8').then((text) =>
		assertGeneratedTypesUseVersion(text, 'packages/core/src/Datasworn.ts')
	),
	readFile('packages/core/src/DataswornSource.ts', 'utf8').then((text) =>
		assertGeneratedTypesUseVersion(text, 'packages/core/src/DataswornSource.ts')
	)
])

await assertSchemaShapeChangesBumpVersion()
await assertPackageVersionSurfaces()

console.log(`Datasworn schema version surfaces agree on ${DATASWORN_SCHEMA_VERSION}`)
