import { Ajv, type ValidateFunction } from 'ajv/dist/ajv.js'
import addFormatsModule from 'ajv-formats/dist/index.js'

import { loadCoreSchemas } from './schema.js'

export type SchemaValidator<TTarget> = (data: unknown) => data is TTarget

export interface DataswornValidators<TOutput, TSource> {
	output: SchemaValidator<TOutput>
	source: SchemaValidator<TSource>
}

function formatErrors(validate: ValidateFunction): string {
	return JSON.stringify(
		validate.errors?.map(({ instancePath, message, params, schemaPath }) => ({
			instancePath,
			message,
			params,
			schemaPath
		})) ?? [],
		undefined,
		2
	)
}

export function createDataswornValidator<TTarget>(
	schema: Record<string, unknown>,
	name: string
): SchemaValidator<TTarget> {
	const ajv = new Ajv({
		allErrors: true,
		allowUnionTypes: true,
		strict: false
	})
	const addFormats = addFormatsModule as unknown as (target: Ajv) => void
	addFormats(ajv)
	ajv.addFormat('markdown', true)

	const validate = ajv.compile(schema)

	return (data: unknown): data is TTarget => {
		if (validate(data)) return true

		throw new Error(`${name} schema validation failed: ${formatErrors(validate)}`)
	}
}

export async function createDataswornValidators<TOutput, TSource>(): Promise<
	DataswornValidators<TOutput, TSource>
> {
	const schemas = await loadCoreSchemas()

	return {
		output: createDataswornValidator<TOutput>(schemas.datasworn, 'Datasworn'),
		source: createDataswornValidator<TSource>(
			schemas.source,
			'Datasworn source'
		)
	}
}
