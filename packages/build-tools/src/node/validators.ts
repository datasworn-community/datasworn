import { createDataswornValidator } from '../validators.js'
import type { DataswornValidators } from '../validators.js'
import { loadCoreSchemas } from './schema.js'

/**
 * Builds validators from the schemas shipped by `@datasworn-community/core`,
 * reading them from disk. Embedded consumers that cannot touch the filesystem
 * should compile their own schemas and use `createDataswornValidator` from the
 * package root instead.
 */
export async function createDataswornValidators<TOutput, TSource>(): Promise<
	DataswornValidators<TOutput, TSource>
> {
	const schemas = await loadCoreSchemas()

	return {
		output: createDataswornValidator<TOutput>(schemas.datasworn, 'Datasworn'),
		source: createDataswornValidator<TSource>(
			schemas.source,
			'Datasworn source',
			{ useDefaults: 'empty' }
		)
	}
}
