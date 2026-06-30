import { IdParser } from '@datasworn-community/core'

/**
 * Collects the Datasworn ID references embedded in a built rules package and
 * validates that each one resolves against a tree. Ported from the upstream
 * `pkg-core/Validators/Text.ts` (`forEachIdRef`) and
 * `RulesPackageBuilder.validateIdRef`, adapted onto the published core
 * `IdParser`. Used to verify cross-package references (e.g. an expansion that
 * points at IDs defined by the ruleset it depends on) actually resolve.
 */

// The `_id` key holds a node's own identity, not a reference to another node.
const IdKey = '_id'

// Keys whose string values are free text / URLs and never bare ID references.
const plainTextKeys = new Set(['label', '_comment', 'name', 'title', 'category'])
const urlKeys = new Set(['url', 'license', 'icon'])
const nonTextKeys = new Set(['dice'])

// Matches a `typeId:path` Datasworn ID (or wildcard) wherever it appears —
// standalone, inside a markdown link, or inside a `{{macro>id}}`.
const idLike =
	/(?<typeId>[a-z\d_.]{3,}|\*{1,2}):(?<path>(?:[a-z_]+|\*{1,2})(?:\/(?:[a-z\d_.]+|\*{1,2})+)+|\*{2})/g

type Primitive = boolean | number | string | null

function forEachPrimitiveValue(
	value: unknown,
	key: string | number | undefined,
	fn: (v: Primitive, k: string | number | undefined) => void
): void {
	switch (typeof value) {
		case 'undefined':
			break
		case 'boolean':
		case 'number':
		case 'string':
			fn(value, key)
			break
		case 'object':
			if (value === null) fn(null, key)
			else if (Array.isArray(value))
				value.forEach((item, index) => forEachPrimitiveValue(item, index, fn))
			else
				for (const [childKey, childValue] of Object.entries(value))
					forEachPrimitiveValue(childValue, childKey, fn)
			break
		default:
			throw new Error(`Unrecognized value type: ${typeof value}`)
	}
}

function needsIdValidation(
	key: string | number | undefined,
	value: unknown
): value is string {
	if (!(typeof key === 'number' || typeof key === 'string')) return false
	if (typeof value !== 'string') return false

	if (
		key === IdKey ||
		plainTextKeys.has(key as string) ||
		urlKeys.has(key as string) ||
		nonTextKeys.has(key as string) ||
		!value.includes('/') ||
		!value.includes(':')
	)
		return false

	return true
}

/** Collect every Datasworn ID reference embedded in `data`. */
export function extractIdRefs(data: unknown): Set<string> {
	const ids = new Set<string>()

	forEachPrimitiveValue(data, undefined, (value, key) => {
		if (!needsIdValidation(key, value)) return
		for (const match of value.matchAll(idLike)) ids.add(match[0])
	})

	return ids
}

export interface IdRefReport {
	/** References that resolve to at least one node in the tree. */
	valid: Set<string>
	/** Strings that look like IDs but cannot be parsed. */
	invalid: Set<string>
	/** Parseable IDs that match no node in the tree. */
	unreachable: Set<string>
}

type Tree = Parameters<IdParser['getMatches']>[0]

function emptyReport(): IdRefReport {
	return { valid: new Set(), invalid: new Set(), unreachable: new Set() }
}

function classifyIdRef(id: string, tree: Tree, report: IdRefReport): void {
	if (report.valid.has(id) || report.invalid.has(id) || report.unreachable.has(id))
		return

	let parsed: IdParser
	try {
		parsed = IdParser.parse(id)
	} catch {
		report.invalid.add(id)
		return
	}

	if (parsed.getMatches(tree, () => true).size > 0) report.valid.add(id)
	else report.unreachable.add(id)
}

/**
 * Validate every ID reference in `data` against `tree`, partitioning them into
 * valid / invalid / unreachable. `tree` should contain the package being built
 * plus any preloaded dependency packages.
 */
export function validateIdRefs(data: unknown, tree: Tree): IdRefReport {
	const report = emptyReport()
	for (const id of extractIdRefs(data)) classifyIdRef(id, tree, report)
	return report
}
