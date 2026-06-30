import type { JSONSchema7 } from 'json-schema'
import { Utils } from '@datasworn-community/core'
import { Keywords } from '../augmentations.js'
import { DefsKey } from '../const.js'

const { compareObjectKeys, dataswornKeyOrder, sortDataswornKeys, sortObjectKeys } =
	Utils

const keywordKeys = [...Object.keys(Keywords)]

export function isSortableObjectSchema(schema: JSONSchema7) {
	switch (true) {
		// skip non-object schema or dictionary-like object

		case schema.patternProperties != null:
			return false
		default:
			return true
	}
}

const schemaKeyOrder = [
	'$schema',
	'$id',
	'$ref',
	'title',
	'type',
	'description',
	'remarks',
	'$comment',
	...keywordKeys,
	'default',
	'examples',
	// constant
	'const',
	'enum',
	// string
	'format',
	'pattern',
	// number
	'multipleOf',
	'minimum',
	'maximum',
	// array
	'items',
	'minItems',
	'maxItems',
	// object
	'required',
	'properties',
	'patternProperties',
	'additionalItems',
	'additionalProperties',
	// union
	'allOf',
	'anyOf',
	'oneOf',
	'if',
	'then',
	'else',
	DefsKey
] as const

export function sortSchemaKeys<T extends JSONSchema7>(schema: T) {
	const sortedSchema = sortObjectKeys(
		schema as Record<string, unknown>,
		schemaKeyOrder
	) as T
	if (sortedSchema.properties != null)
		sortedSchema.properties = sortDataswornKeys(
			sortedSchema.properties as Record<string, unknown>
		) as T['properties']
	if (Array.isArray(sortedSchema.required)) {
		sortedSchema.required = sortedSchema.required.sort((a, b) =>
			compareObjectKeys(a, b, dataswornKeyOrder)
		)
	}

	return sortedSchema
}
