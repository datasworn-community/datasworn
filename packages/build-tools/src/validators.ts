import { Ajv, type ValidateFunction } from 'ajv/dist/ajv.js'
import type { Options } from 'ajv/dist/core.js'
import addFormatsModule from 'ajv-formats/dist/index.js'

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
	name: string,
	options: Options = {}
): SchemaValidator<TTarget> {
	const ajv = new Ajv({
		allErrors: true,
		allowUnionTypes: true,
		strict: false,
		...options
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
