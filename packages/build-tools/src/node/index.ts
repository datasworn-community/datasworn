/**
 * Filesystem-backed build entry point. Everything here reads or writes through
 * Node builtins, so it must never be imported from the package root — see
 * `../index.ts`.
 */
export {
	buildRulesPackage,
	type BuildRulesPackageOptions,
	type RulesPackageBuildConfig,
	type RulesPackageBuildResult
} from './rules-package-builder.js'
export {
	buildContentPackages,
	type ContentPackageBuildConfig,
	type ContentPackageBuildResult,
	type ContentPackageDependencyConfig,
	type MultiPackageBuildConfig,
	type MultiPackageBuildResult,
	type PackageRepository
} from './content-package-builder.js'
export {
	loadCoreSchema,
	loadCoreSchemas,
	resolveCoreSchemaPath,
	type CoreSchemaFileName
} from './schema.js'
export { createDataswornValidators } from './validators.js'
