import { execFile } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'

import { DATASWORN_SCHEMA_VERSION } from '@datasworn-community/core'

const execFileAsync = promisify(execFile)

const schemaReleaseLabels = ['release:minor-schema', 'release:major-schema']
const releaseLabels = [...schemaReleaseLabels, 'release:none', 'release:patch']
const schemaSensitivePatterns = [
	/^packages\/build-tools\/schema-source\//,
	/^packages\/core\/json\//,
	/^packages\/core\/src\/Datasworn(?:Source|Version)?\.ts$/
]

interface PackageJson {
	version: string
}

interface Semver {
	major: number
	minor: number
	patch: number
}

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message)
}

function parseSemver(version: string): Semver {
	const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
	assert(match, `Expected plain semver version, received ${version}`)
	return {
		major: Number(match[1]),
		minor: Number(match[2]),
		patch: Number(match[3])
	}
}

function formatSemver(version: Semver): string {
	return `${version.major}.${version.minor}.${version.patch}`
}

async function readJson<T>(filePath: string): Promise<T> {
	return JSON.parse(await readFile(filePath, 'utf8')) as T
}

async function currentPackageVersion(): Promise<string> {
	const root = await readJson<PackageJson>('package.json')
	const core = await readJson<PackageJson>('packages/core/package.json')
	const buildTools = await readJson<PackageJson>(
		'packages/build-tools/package.json'
	)

	assert(
		root.version === core.version && core.version === buildTools.version,
		`core/build-tools versions must stay in lockstep; found root=${root.version}, core=${core.version}, build-tools=${buildTools.version}`
	)

	return root.version
}

async function git(args: string[]): Promise<string> {
	const { stdout } = await execFileAsync('git', args)
	return stdout.trim()
}

async function changedFiles(): Promise<string[]> {
	const base = process.env.RELEASE_BASE_SHA
	const head = process.env.RELEASE_HEAD_SHA ?? 'HEAD'

	if (base) {
		const output = await git(['diff', '--name-only', `${base}..${head}`])
		return output ? output.split('\n') : []
	}

	const defaultBase = process.env.RELEASE_BASE_REF ?? 'origin/main'
	const output = await git(['diff', '--name-only', `${defaultBase}...${head}`])
	return output ? output.split('\n') : []
}

function hasSchemaImpact(files: readonly string[]): boolean {
	return files.some((file) =>
		schemaSensitivePatterns.some((pattern) => pattern.test(file))
	)
}

async function labelsFromAssociatedPullRequest(): Promise<string[]> {
	const repository = process.env.GITHUB_REPOSITORY
	const sha = process.env.GITHUB_SHA
	const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN
	if (!repository || !sha || !token) return []

	const { stdout } = await execFileAsync(
		'gh',
		[
			'api',
			`repos/${repository}/commits/${sha}/pulls`,
			'--header',
			'Accept: application/vnd.github+json',
			'--jq',
			'.[0].labels[].name'
		],
		{ env: { ...process.env, GH_TOKEN: token } }
	)

	return stdout
		.split('\n')
		.map((label) => label.trim())
		.filter(Boolean)
}

async function releaseLabelsFromEnvironment(): Promise<string[]> {
	const labelsJson = process.env.PR_LABELS_JSON
	const labels =
		labelsJson && labelsJson !== 'null'
			? (JSON.parse(labelsJson) as unknown[])
			: await labelsFromAssociatedPullRequest()

	return labels
		.filter((label): label is string => typeof label === 'string')
		.filter((label) => releaseLabels.includes(label))
}

function assertSingleSchemaReleaseLabel(labels: readonly string[]): string {
	assertReleaseLabelsUnambiguous(labels)

	const schemaLabels = labels.filter((label) =>
		[...schemaReleaseLabels, 'release:none'].includes(label)
	)

	assert(
		schemaLabels.length === 1,
		`Schema-sensitive changes require exactly one of ${[
			...schemaReleaseLabels,
			'release:none'
		].join(', ')}; found ${schemaLabels.length === 0 ? 'none' : schemaLabels.join(', ')}`
	)

	return schemaLabels[0]!
}

function assertReleaseLabelsUnambiguous(labels: readonly string[]): void {
	assert(
		labels.length <= 1,
		`Release intent is ambiguous; use at most one release label, found ${labels.join(', ')}`
	)
}

async function checkPullRequest(): Promise<void> {
	const files = await changedFiles()
	if (!hasSchemaImpact(files)) {
		console.log('No schema-sensitive changes detected; no schema release label required.')
		return
	}

	const labels = await releaseLabelsFromEnvironment()
	const label = assertSingleSchemaReleaseLabel(labels)
	console.log(`Schema-sensitive changes detected; release intent label is ${label}.`)
}

function output(name: string, value: string | boolean): void {
	const line = `${name}=${String(value)}`
	if (process.env.GITHUB_OUTPUT)
		appendFileSync(process.env.GITHUB_OUTPUT, `${line}\n`)
	else console.log(line)
}

function assertSchemaVersionMatchesLabel(
	label: string,
	currentVersion: string,
	nextVersion: string
): void {
	const current = parseSemver(currentVersion)
	const next = parseSemver(nextVersion)

	if (label === 'release:major-schema')
		assert(
			next.major > current.major,
			`release:major-schema requires DATASWORN_SCHEMA_VERSION to advance major version beyond ${currentVersion}; found ${nextVersion}`
		)

	if (label === 'release:minor-schema')
		assert(
			next.major === current.major && next.minor > current.minor,
			`release:minor-schema requires DATASWORN_SCHEMA_VERSION to advance minor version beyond ${currentVersion}; found ${nextVersion}`
		)

	assert(
		next.patch === 0,
		`Schema-line releases must reset patch to 0; found ${nextVersion}`
	)
}

async function planMainRelease(): Promise<void> {
	const message = await git(['log', '-1', '--pretty=%s'])
	if (message.startsWith('chore: release v')) {
		output('release', false)
		output('reason', 'release commit')
		return
	}

	const files = await changedFiles()
	const labels = await releaseLabelsFromEnvironment()
	assertReleaseLabelsUnambiguous(labels)
	const currentVersion = await currentPackageVersion()
	const schemaImpact = hasSchemaImpact(files)

	if (schemaImpact) {
		const label = assertSingleSchemaReleaseLabel(labels)

		if (label === 'release:none') {
			output('release', false)
			output('reason', 'schema-sensitive change explicitly marked release:none')
			return
		}

		assertSchemaVersionMatchesLabel(
			label,
			currentVersion,
			DATASWORN_SCHEMA_VERSION
		)
		output('release', true)
		output('increment', label)
		output('version', DATASWORN_SCHEMA_VERSION)
		output('reason', `schema-sensitive change marked ${label}`)
		return
	}

	if (labels.includes('release:none')) {
		output('release', false)
		output('reason', 'release:none')
		return
	}

	const current = parseSemver(currentVersion)
	const next = formatSemver({ ...current, patch: current.patch + 1 })
	output('release', true)
	output('increment', 'patch')
	output('version', next)
	output('reason', 'auto patch for non-schema main change')
}

const command = process.argv[2]

if (command === 'check-pr') await checkPullRequest()
else if (command === 'plan-main') await planMainRelease()
else
	throw new Error(
		`Usage: bun ./scripts/releasePlan.ts <check-pr|plan-main>, received ${String(command)}`
	)
