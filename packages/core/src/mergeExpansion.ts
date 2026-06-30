import {
	CollectionsKey,
	ContentsKey,
	EnhancesKey,
	ReplacesKey
} from './IdElements/CONST.js'
import TypeId from './IdElements/TypeId.js'
import type * as Datasworn from './Datasworn.js'
import { IdParser } from './IdParser.js'
import type TypeNode from './TypeNode.js'

/**
 * Applies overrides to Datasworn collection from another Datasworn collection.
 * Mutates `target`.
 * @param target The collection object to be enhanced.
 * @param source The changes to be applied to `target`
 * @returns The mutated `target`
 * @throws If the `source` is missing a matching wildcardId.
 * @experimental
 */
function enhanceCollection<T extends TypeNode.Collection>(
	target: T,
	source: T
): T {
	const err = new Error(
		`Expected source <${source._id}> "${EnhancesKey}" property to include a wildcard matching target <${target._id}>, but got ${JSON.stringify(source[EnhancesKey])}.`
	)
	if (!(EnhancesKey in source)) throw err
	if (!Array.isArray(source[EnhancesKey])) throw err

	const targetId = IdParser.parse(target._id)

	if (!targetId.isMatchedBy(...source[EnhancesKey])) throw err
	target[ContentsKey] = applyDictionaryReplacements(
		target[ContentsKey],
		source[ContentsKey]
	)

	;(target as unknown as Record<string, unknown>)[CollectionsKey] =
		applyDictionaryEnhancements(
			(target as unknown as Record<string, unknown>)[CollectionsKey] as Record<
				string,
				T
			>,
			(source as unknown as Record<string, unknown>)[CollectionsKey] as Record<
				string,
				T
			>
		)

	return target
}

function applyDictionaryEnhancements<
	T extends TypeNode.Collection,
	TTarget extends Map<string, T> | Record<string, T> | undefined,
	TSource extends Map<string, T> | Record<string, T> | undefined
>(targetDictionary: TTarget, sourceDictionary: TSource) {
	// Handle undefined dictionaries (e.g., when a collection has no nested collections)
	if (sourceDictionary == null) return targetDictionary
	if (targetDictionary == null) return sourceDictionary

	const targetMap: Map<string, T> =
		targetDictionary instanceof Map
			? targetDictionary
			: new Map(Object.entries(targetDictionary))
	const sourceMap: Map<string, T> =
		sourceDictionary instanceof Map
			? sourceDictionary
			: new Map(Object.entries(sourceDictionary))

	for (const [key, source] of sourceMap) {
		if (!targetMap.has(key)) {
			targetMap.set(key, source)
			continue
		}

		if (!(EnhancesKey in source)) continue

		const target = targetMap.get(key) as T

		targetMap.set(key, enhanceCollection(target, source))
	}

	const result =
		targetDictionary instanceof Map ? targetMap : Object.fromEntries(targetMap)

	return result as TTarget
}

function applyDictionaryReplacements<
	T extends
		| TypeNode.Collectable
		| TypeNode.NonCollectable
		| TypeNode.Collection,
	TTarget extends Map<string, T> | Record<string, T>,
	TSource extends Map<string, T> | Record<string, T>
>(targetDictionary: TTarget, sourceDictionary: TSource) {
	const targetMap: Map<string, T> =
		targetDictionary instanceof Map
			? targetDictionary
			: new Map(Object.entries(targetDictionary))
	const sourceMap: Map<string, T> =
		sourceDictionary instanceof Map
			? sourceDictionary
			: new Map(Object.entries(sourceDictionary))

	for (const [key, source] of sourceMap) {
		if (!targetMap.has(key)) {
			targetMap.set(key, source)
			continue
		}

		if (!(ReplacesKey in source)) continue

		const target = targetMap.get(key) as T

		const err = new Error(
			`Expected source <${source._id}> "${ReplacesKey}" property to include a wildcard matching target <${target._id}>, but got ${JSON.stringify(source[ReplacesKey])}`
		)
		if (!(ReplacesKey in source)) throw err
		if (!Array.isArray(source[ReplacesKey])) throw err

		const targetValueId = IdParser.parse(target._id)

		if (!targetValueId.isMatchedBy(...source[ReplacesKey])) throw err

		targetMap.set(key, source)
	}

	const result =
		targetDictionary instanceof Map ? targetMap : Object.fromEntries(targetMap)

	return result as TTarget
}

export function mergeExpansion(
	ruleset: Datasworn.Ruleset,
	expansion: Datasworn.Expansion,
	strict = true
) {
	if (strict && ruleset._id !== expansion.ruleset)
		throw new Error(
			`Can only merge to the expansion's matching ruleset "${expansion.ruleset}" in strict mode, but got ruleset "${ruleset._id}".`
		)

	const collections = TypeId.Collectable.map(TypeId.getBranchKey)

	for (const branchKey of collections) {
		if (!(branchKey in expansion)) continue
		const expansionBranch = (expansion as unknown as Record<string, unknown>)[
			branchKey
		]
		if (!(branchKey in ruleset))
			// @ts-expect-error
			ruleset[branchKey] = expansionBranch
		else {
			const rulesetBranch = (ruleset as unknown as Record<string, unknown>)[
				branchKey
			]
			if (
				expansionBranch &&
				typeof expansionBranch === 'object' &&
				ReplacesKey in expansionBranch
			) {
				// @ts-expect-error
				ruleset[branchKey] = applyDictionaryReplacements(
					rulesetBranch as Record<string, TypeNode.Collection>,
					expansionBranch as Record<string, TypeNode.Collection>
				)
			} else {
				// @ts-expect-error
				ruleset[branchKey] = applyDictionaryEnhancements(
					rulesetBranch as Record<string, TypeNode.Collection>,
					expansionBranch as Record<string, TypeNode.Collection>
				)
			}
		}
	}

	return ruleset
}
