import { type TSchema, Type } from '@sinclair/typebox'
import { UnionEnum } from '../Utils.js'

const _TagsClassic = {}
const _TagsStarforged = {
	recommended: Type.Boolean({
		description: 'This object is ideal for use in Starforged.'
	})
} satisfies Record<string, TSchema>
const _TagsDelve = {} satisfies Record<string, TSchema>
type _TagParams = {
	schema: TSchema
	node_types: []
}
const _TagsSunderedIsles = {
	recommended: Type.Boolean({
		description: 'This object is ideal for use in Sundered Isles.'
	}),
	cursed_version_of: Type.Array(Type.Ref('OracleRollableIdWildcard')),
	// wrap these into their own objects: "cursed" and "curses"?
	curse_behavior: Type.Array(UnionEnum(['replace_result', 'add_result'])),
	cursed_by: Type.Array(Type.String()),
	region: UnionEnum(['myriads', 'margins', 'reaches'])
	// overland_region
	// location
	// faction_type
	// ship_size
	// treasure_size
} satisfies Record<string, TSchema>
