import path from 'node:path'
import { DATASWORN_SCHEMA_VERSION, IdElements } from '@datasworn-community/core'

const root = process.cwd()

export const VERSION = DATASWORN_SCHEMA_VERSION

export const PKG_NAME = 'Datasworn'
export const SCHEMA_NAME = 'Datasworn'
export const SOURCE_SCHEMA_NAME = 'DataswornSource'

export const PKG_SCOPE_OFFICIAL = '@datasworn'
export const PKG_SCOPE_COMMUNITY = '@datasworn-community'

export const ROOT_OUTPUT = path.join(root, 'datasworn')
export const ROOT_SOURCE_DATA = path.join(root, 'source_data')
export const ROOT_HISTORY = path.join(root, 'packages/core/migration')
export const DIR_HISTORY_CURRENT = path.join(ROOT_HISTORY, VERSION)
// Disposable scratch copy of generated types, emptied and rewritten on every
// `generate` run. Must stay distinct from CORE_COMMON: writeTypescriptTypes
// empties this directory before writing, and CORE_COMMON holds core's
// hand-written runtime source alongside the generated Datasworn.ts/
// DataswornSource.ts files.
export const ROOT_TYPES_OUT = path.join(root, '.generated/types')
export const CORE_COMMON = path.join(root, 'packages/core/src')

export const SCHEMA_PATH = path.join(
	root,
	'packages/core/json/datasworn.schema.json'
)
export const SOURCE_SCHEMA_PATH = path.join(
	root,
	'packages/core/json/datasworn-source.schema.json'
)
export const SOURCEDATA_SCHEMA_PATH = SOURCE_SCHEMA_PATH

export const SCHEMA_DELVE_OUT = path.join(
	ROOT_OUTPUT,
	'datasworn-delve.schema.json'
)
export const SCHEMA_DELVE_IN = path.join(
	ROOT_OUTPUT,
	'datasworn-delve-source.schema.json'
)

export const SCHEMA_ID = 'https://ironswornrpg.com/datasworn.schema.json'
export const SOURCE_SCHEMA_ID =
	'https://ironswornrpg.com/datasworn-source.schema.json'
export const DELVE_SCHEMA_ID =
	'https://ironswornrpg.com/datasworn-delve.schema.json'
export const DELVE_SOURCE_ID =
	'https://ironswornrpg.com/datasworn-delve-source.schema.json'

/** JSON schema draft used by Datasworn. */
export const $schema = 'http://json-schema.org/draft-07/schema#' as const
/** The standard key for definitions in the JSON schema draft. */
export const DefsKey = 'definitions' as const

/** Identifier for the type at the root of a Datasworn JSON file. */
export const rootSchemaName = 'RulesPackage'

// Re-exported from core's IdElements/CONST.js. Upstream colocates these
// scripts with pkg-core under one `src/`, so its const.ts can `export *`
// straight from the relative path; here build-tools and core are separate
// workspace packages, so the keys are re-exported through core's public API.
export const COLLECTION_DEPTH_MAX = IdElements.CONST.COLLECTION_DEPTH_MAX
export type COLLECTION_DEPTH_MAX = typeof COLLECTION_DEPTH_MAX
export const COLLECTION_DEPTH_MIN = IdElements.CONST.COLLECTION_DEPTH_MIN
export type COLLECTION_DEPTH_MIN = typeof COLLECTION_DEPTH_MIN
export const MdLinkPrefix = IdElements.CONST.MdLinkPrefix
export type MdLinkPrefix = typeof MdLinkPrefix
export const PathKeySep = IdElements.CONST.PathKeySep
export type PathKeySep = typeof PathKeySep
export const TypeSep = IdElements.CONST.TypeSep
export type TypeSep = typeof TypeSep
export const PrefixSep = IdElements.CONST.PrefixSep
export type PrefixSep = typeof PrefixSep
export const WildcardString = IdElements.CONST.WildcardString
export type WildcardString = typeof WildcardString
export const GlobstarString = IdElements.CONST.GlobstarString
export type GlobstarString = typeof GlobstarString
export const CollectionsKey = IdElements.CONST.CollectionsKey
export type CollectionsKey = typeof CollectionsKey
export const ContentsKey = IdElements.CONST.ContentsKey
export type ContentsKey = typeof ContentsKey
export const EnhancesKey = IdElements.CONST.EnhancesKey
export type EnhancesKey = typeof EnhancesKey
export const ReplacesKey = IdElements.CONST.ReplacesKey
export type ReplacesKey = typeof ReplacesKey
export const IdKey = IdElements.CONST.IdKey
export type IdKey = typeof IdKey
export const SourceInfoKey = IdElements.CONST.SourceInfoKey
export type SourceInfoKey = typeof SourceInfoKey
