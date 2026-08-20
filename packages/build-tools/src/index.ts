/**
 * The package root is the portable entry point: nothing reachable from here
 * imports a Node builtin, so it is safe to bundle for browsers, Obsidian
 * plugins, and web workers. Filesystem-backed builds live in
 * `@datasworn-community/build-tools/node`.
 */
export {
	RulesPackageBuilder,
	type Logger,
	type NamedRulesPackageSource
} from './in-memory-rules-package-builder.js'
export {
	createDataswornValidator,
	type DataswornValidators,
	type SchemaValidator
} from './validators.js'
export {
	Validators,
	validateDiceRange,
	validateOracleCollection,
	validateOracleRollable,
	validateOracleRollableRow
} from './semantic-validators.js'
export {
	extractIdRefs,
	validateIdRefs,
	type IdRefReport
} from './id-references.js'
