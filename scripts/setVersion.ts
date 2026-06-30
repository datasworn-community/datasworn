import { readFile, writeFile } from 'node:fs/promises'

/**
 * Propagate a release version across the published workspace packages in
 * lockstep. Invoked by release-it's `after:bump` hook so that core, build-tools,
 * and build-tools' exact `@datasworn-community/core` peer range can never drift
 * apart — `check:schema-version` asserts `peer === core.version`.
 *
 * Usage: `bun ./scripts/setVersion.ts <version>`
 */

const version = process.argv[2]

if (!version || !/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(version)) {
	throw new Error(
		`setVersion expects a semver version argument, received: ${String(version)}`
	)
}

async function replaceInFile(
	filePath: string,
	pattern: RegExp,
	replacement: string,
	label: string
) {
	const original = await readFile(filePath, 'utf8')
	const updated = original.replace(pattern, replacement)
	if (updated === original)
		throw new Error(`setVersion did not update ${label} in ${filePath}`)
	await writeFile(filePath, updated)
}

// core package version
await replaceInFile(
	'packages/core/package.json',
	/("version":\s*")[^"]*(")/,
	`$1${version}$2`,
	'version'
)

// build-tools package version
await replaceInFile(
	'packages/build-tools/package.json',
	/("version":\s*")[^"]*(")/,
	`$1${version}$2`,
	'version'
)

// build-tools exact peer pin on core (the numeric core ref; the workspace:*
// devDependency starts with a letter and is intentionally left untouched)
await replaceInFile(
	'packages/build-tools/package.json',
	/("@datasworn-community\/core":\s*")\d[^"]*(")/,
	`$1${version}$2`,
	'core peer range'
)

console.log(`Set core + build-tools (and peer range) to ${version}`)
