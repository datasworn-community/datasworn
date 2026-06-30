import path from 'node:path'
import { DATASWORN_SCHEMA_VERSION } from '@datasworn-community/core'

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
export const ROOT_TYPES_OUT = path.join(root, 'packages/core/src')
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
