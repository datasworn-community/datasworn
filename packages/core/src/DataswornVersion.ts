/**
 * The Datasworn data/schema format version stored in `datasworn_version`.
 *
 * This is intentionally separate from the npm package version in `package.json`.
 */
export const DATASWORN_SCHEMA_VERSION = '0.1.0' as const
export type DataswornSchemaVersion = typeof DATASWORN_SCHEMA_VERSION
