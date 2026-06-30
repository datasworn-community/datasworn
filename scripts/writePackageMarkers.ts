import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

async function writeJson(filePath: string, value: unknown) {
	await mkdir(dirname(filePath), { recursive: true })
	await writeFile(filePath, `${JSON.stringify(value)}\n`)
}

await Promise.all([
	writeJson('packages/core/dist/cjs/package.json', { type: 'commonjs' }),
	writeJson('packages/core/dist/esm/package.json', { type: 'module' })
])
