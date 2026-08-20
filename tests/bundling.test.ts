import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { build } from 'esbuild'

import packageJson from '../packages/build-tools/package.json' with { type: 'json' }

/**
 * The package root must stay importable from bundlers that target browsers,
 * Obsidian plugins, and web workers. esbuild resolves every import during its
 * scan pass, before tree shaking runs, so a Node builtin anywhere in the root's
 * module graph is a hard build error for those consumers even when the imported
 * binding is unused — `sideEffects: false` does not rescue it.
 *
 * These bundle the emitted `dist/` files by path rather than by package name,
 * because the root tsconfig `paths` map aliases the package name to `src/`. Only
 * the built output is what consumers actually resolve.
 *
 * Regression test for the barrel that re-exported the filesystem builders
 * alongside `RulesPackageBuilder`.
 */
const buildToolsDir = path.join(import.meta.dir, '../packages/build-tools')

function entryPoint(subpath: '.' | './node'): string {
	const target = packageJson.exports[subpath].default
	const resolved = path.join(buildToolsDir, target)

	if (!existsSync(resolved))
		throw new Error(
			`${target} is missing; run \`bun run build\` before these tests. They bundle the emitted output, not src.`
		)

	return resolved
}

async function bundleForBrowser(entry: string) {
	return build({
		entryPoints: [entry],
		bundle: true,
		write: false,
		format: 'esm',
		platform: 'browser',
		treeShaking: true,
		logLevel: 'silent'
	})
}

describe('browser bundling', () => {
	test('the built root entry bundles with no Node builtins available', async () => {
		const result = await bundleForBrowser(entryPoint('.'))

		const [output] = result.outputFiles
		expect(output).toBeDefined()
		expect(output!.text).not.toContain('node:')
	})

	test('the node entry is where the Node builtins live', async () => {
		const attempt = bundleForBrowser(entryPoint('./node'))

		await expect(attempt).rejects.toThrow(/Could not resolve "node:/)
	})
})
