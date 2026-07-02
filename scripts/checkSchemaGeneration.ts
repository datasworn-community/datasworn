/**
 * Asserts that the committed schema + generated type artifacts are exactly
 * what `bun run generate` produces from `schema-source`. Catches the case
 * where schema-source was edited but `generate` wasn't re-run before commit.
 */
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const generatedPaths = [
	'packages/core/json/datasworn.schema.json',
	'packages/core/json/datasworn-source.schema.json',
	'packages/core/src/Datasworn.ts',
	'packages/core/src/DataswornSource.ts'
]

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message)
}

async function snapshot(paths: string[]) {
	const entries = await Promise.all(
		paths.map(async (path) => [path, await readFile(path, 'utf8')] as const)
	)
	return new Map(entries)
}

const before = await snapshot(generatedPaths)

await execFileAsync('bun', ['run', 'generate'])

const after = await snapshot(generatedPaths)

const stale = generatedPaths.filter((path) => before.get(path) !== after.get(path))

assert(
	stale.length === 0,
	`Generated artifacts are stale: ${stale.join(', ')}. Run "bun run generate" and commit the result.`
)
