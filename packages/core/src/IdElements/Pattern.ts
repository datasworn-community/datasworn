import {
	COLLECTION_DEPTH_MAX,
	COLLECTION_DEPTH_MIN,
	PathKeySep
} from './CONST.js'

/**
 * Regular expressions used to validate Datasworn ID elements.
 */
namespace Pattern {
	const DictKeyBase = /[a-z][a-z0-9_]*/
	export const DictKeyElement = DictKeyBase
	export const DictKey = new RegExp(`^${DictKeyBase.source}$`)
	const RulesPackageBase = DictKeyBase
	export const RulesPackageElement = RulesPackageBase
	export const RulesPackageId = new RegExp(`^${RulesPackageBase.source}$`)

	export const IndexElement = /\d+/

	const RecursiveDictKeysBase = new RegExp(
		`${DictKeyBase.source}(?:\\${PathKeySep}${DictKeyBase.source}){${COLLECTION_DEPTH_MIN - 1},${COLLECTION_DEPTH_MAX - 1}}`
	)

	export const RecursiveDictKeysElement = RecursiveDictKeysBase
}

export default Pattern
