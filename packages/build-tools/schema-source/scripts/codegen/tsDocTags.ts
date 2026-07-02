// @alpha
// @beta
// @category
// @defaultValue
// @deprecated
// @enum
// @event
// @eventProperty
// @example
// @experimental
// @group
// @hidden
// @ignore
// {@inheritDoc}
// @interface
// @internal
// {@label}
// {@link}
// @module
// @namespace
// @overload
// @override
// @packageDocumentation
// @param
// @private
// @privateRemarks
// @property
// @protected
// @public
// @readonly
// @remarks
// @returns
// @satisfies
// @sealed
// @see
// @template
// @throws
// @typeParam

import { Type } from '@sinclair/typebox'
import type { KeywordDefinition } from 'ajv'

// @virtual
const _tags: Record<string, Omit<KeywordDefinition, 'keyword'>> = {
	alpha: { metaSchema: Type.Boolean() },
	beta: { metaSchema: Type.Boolean() },
	category: { metaSchema: Type.String() },
	deprecated: { metaSchema: Type.Boolean() },
	event: { metaSchema: Type.Boolean() },
	eventProperty: { metaSchema: Type.Boolean() },
	example: { metaSchema: Type.Boolean() },
	experimental: { metaSchema: Type.Boolean() },
	group: { metaSchema: Type.Array(Type.String()) },
	hidden: { metaSchema: Type.Boolean() },
	ignore: { metaSchema: Type.Boolean() },
	interface: { metaSchema: Type.Boolean() },
	internal: { metaSchema: Type.Boolean() },
	namespace: { metaSchema: Type.Array(Type.String()) },
	overload: { metaSchema: Type.Boolean() },
	override: { metaSchema: Type.Boolean() },
	packageDocumentation: { metaSchema: Type.Boolean() },
	param: { metaSchema: Type.Boolean() },
	private: { metaSchema: Type.Boolean() },
	privateRemarks: { metaSchema: Type.String() },
	property: { metaSchema: Type.Boolean() },
	remarks: { metaSchema: Type.String() },
	returns: { metaSchema: Type.Boolean() },
	satisfies: { metaSchema: Type.Boolean() },
	sealed: { metaSchema: Type.Boolean() },
	see: { metaSchema: Type.Array(Type.String()) },
	template: { metaSchema: Type.Boolean() },
	throws: { metaSchema: Type.Boolean() },
	typeParam: { metaSchema: Type.Boolean() },
	virtual: { metaSchema: Type.Boolean() }
}
