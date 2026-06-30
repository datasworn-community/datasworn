import {
	CollectionsKey,
	ContentsKey,
	EnhancesKey,
	IdKey,
	ReplacesKey
} from '../IdElements/CONST.js'
import Pattern from '../IdElements/Pattern.js'
import type { Datasworn } from '../index.js'

export const unsortableKeys = [
	'columns',
	'controls',
	ContentsKey,
	'options',
	CollectionsKey,
	'choices'
] as const

export const idKeys = [IdKey, '_key', '_index'] as const

export const relationshipKeys = [
	ReplacesKey,
	EnhancesKey,
	'oracle',
	'asset',
	'region',
	'theme',
	'domain',
	'name_oracle',
	'npc',
	'extra_card'
] as const

// TODO: this could be done programmatically by looking at the appropriate symbol key on DiscriminatedUnion schemas
export const discriminatorKeys = [
	'type',
	'category',
	'field_type',
	'roll_type',
	'choice_type',
	'oracle_type',
	'value_type',
	'using'
] as const

export const usageKeys = [
	'auto',
	'duplicates',
	'number_of_rolls',
	'by',
	'method',
	'roll_options',
	'ally',
	'player',
	'is_impact',
	'disables_asset'
] as const

export const shortDescriptionKeys = [
	'result',
	'summary',
	'detail',
	'requirement',
	'features',
	'dangers',
	'drives',
	'tactics'
] as const
export const longDescriptionKeys = [
	'text',
	'text2',
	'text3',
	'description',
	'your_character'
] as const
export const longArrayKeys = [
	'denizens',
	'enhance_moves',
	'rows',
	'table'
] as const
export const numericKeys = ['min', 'max', 'value', 'rank'] as const
export const rulesKeys = [
	// top level
	'condition_meters',
	'stats',
	'impacts',
	'special_tracks',
	// properties
	'rollable',
	'prevents_recovery',
	'permanent',
	'optional',
	'control',
	'option',
	'condition_meter',
	'stat',

	'tracks',
	'conditions',

	'recover',
	'suffer',
	'choices',
	'xp_cost'
] as const
export const sourceMetadataKeys = [
	'email',
	'authors',
	'date',
	'license',
	'page',
	'title',
	'url'
] as const satisfies (
	| keyof Datasworn.SourceInfo
	| keyof Omit<Datasworn.AuthorInfo, 'name'>
)[]

export const dataswornKeyOrder = [
	...idKeys,
	'datasworn_version',
	'type',
	'ruleset',
	'title',
	'name',
	'canonical_name',
	'label',
	...discriminatorKeys,
	...sourceMetadataKeys,
	'rules',
	...rulesKeys,
	...relationshipKeys,
	...numericKeys,
	'nature',
	'color',
	'icon',
	'images',
	'track',
	'dice',
	'enabled',
	'frequency',
	'options',
	'count_as_impact',
	...usageKeys,
	'shared',
	'attachments',
	'trigger',
	'roll',
	...shortDescriptionKeys,
	'strong_hit',
	'weak_hit',
	'miss',
	'variants',
	...longDescriptionKeys,
	'abilities',
	'template',
	'rolls',
	ContentsKey,
	CollectionsKey,
	'outcomes',
	'quest_starter',
	'your_truth',
	'controls',
	'date',
	'page',
	'authors',
	'license',
	'url',
	'embed_table',
	'match',
	'recommended_rolls',
	// relationships
	'oracles',
	'suggestions',
	'enhance_asset',
	'oracle_rolls',
	'tags',

	'_comment',
	// so it appears immediately above rows
	'column_labels',
	// very long content
	...longArrayKeys,

	'assets',
	'atlas',
	'moves',
	'npcs',
	'rarities',
	'delve_sites',
	'site_domains',
	'site_themes',
	'truths',
	'_source',
	'_i18n'
] as const satisfies string[]

export function compareObjectKeys(
	a: string,
	b: string,
	keyOrder: Readonly<string[]> = [],
	unsortableKeys?: Set<string>
) {
	const [indexA, indexB] = [a, b].map((key) => {
		const index = keyOrder.indexOf(key)
		if (unsortableKeys != null && index === -1)
			// logger.warn(`key ${key} has not been assigned a sort order.`)
			unsortableKeys.add(key)

		return index
	})

	// this shouldn't happen; but if a and b are the same, fall back to alphabetical order.
	if (indexA === indexB) return a.localeCompare(b, 'en-US')

	// if one key lacks an explicit sort, place it last
	if (indexA === -1) return 1
	if (indexB === -1) return -1

	return indexA - indexB
}
export function sortDataswornKeys(value: Record<string, unknown>) {
	return sortObjectKeys(value, dataswornKeyOrder)
}

function _isPOJO(value: unknown): value is Record<string, unknown> {
	if (typeof value !== 'object') return false
	if (value === null) return false
	if (Array.isArray(value)) return false
	return true
}

type IdNode = { _id: string } & Record<string, unknown>

function _isIdNode(value: unknown): value is IdNode {
	if (!_isPOJO(value)) return false
	if (!(IdKey in value)) return false

	const id = value[IdKey]

	return typeof id === 'string'
}

function _isDictionaryOfPOJOs(
	value: unknown
): value is Record<string, Record<string, unknown>> {
	if (!_isPOJO(value)) return false

	for (const k in value) {
		if (!Pattern.DictKey.test(k)) return false
		const dict_entry = value[k]
		if (!_isPOJO(dict_entry)) return false
	}
	return true
}

function _isDictionaryOfIdNodes(
	value: unknown
): value is Record<string, IdNode> {
	if (!_isPOJO(value)) return false

	for (const k in value) {
		if (!Pattern.DictKey.test(k)) return false
		const dict_entry = value[k]
		if (!_isIdNode(dict_entry)) return false
	}

	return true
}

function _sortObject(key: string | number, value: Record<string, unknown>) {
	if (_isDictionaryOfPOJOs(value)) return value
}

const sortBlacklist = [
	'options',
	'controls',
	'contents',
	'collections',
	'oracles',
	'assets',
	'moves',
	'variants'
]

export function sortJson(key: string | number, value: unknown) {
	if (sortBlacklist.includes(key as string)) return value
	if (!_isPOJO(value)) return value
	if (_isDictionaryOfIdNodes(value)) return value

	return sortDataswornKeys(value)
}

export function sortObjectKeys<T extends Record<string, unknown>>(
	object: T,
	keyOrder: Readonly<string[]>
) {
	const entries = Object.entries(object).sort(([a], [b]) =>
		compareObjectKeys(a, b, keyOrder)
	)
	return Object.fromEntries(entries) as T
}
