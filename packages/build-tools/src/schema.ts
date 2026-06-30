import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

export type CoreSchemaFileName =
	| 'datasworn.schema.json'
	| 'datasworn-source.schema.json'

const require = createRequire(import.meta.url)

export function resolveCoreSchemaPath(fileName: CoreSchemaFileName): string {
	return require.resolve(`@datasworn-community/core/json/${fileName}`)
}

export async function loadCoreSchema(fileName: CoreSchemaFileName) {
	const schemaPath = resolveCoreSchemaPath(fileName)
	return JSON.parse(await readFile(schemaPath, 'utf8')) as Record<string, unknown>
}

export async function loadCoreSchemas() {
	const [datasworn, source] = await Promise.all([
		loadCoreSchema('datasworn.schema.json'),
		loadCoreSchema('datasworn-source.schema.json')
	])

	return { datasworn, source }
}
