#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import { Migrations } from '@datasworn-community/core'

import { hasArg, readArg } from './args.js'

function usage(): never {
	console.error(`Usage:
  datasworn-migrate --map id_map.json --input old.json --output new.json`)
	process.exit(1)
}

const args = process.argv.slice(2)
if (hasArg(args, '--help') || hasArg(args, '-h')) usage()

const mapPath = readArg(args, '--map')
const inputPath = readArg(args, '--input')
const outputPath = readArg(args, '--output')
if (mapPath == null || inputPath == null || outputPath == null) usage()

const replacementMap = JSON.parse(await readFile(mapPath, 'utf8')) as Record<
	string,
	string | null
>
const input = await readFile(inputPath, 'utf8')
const unreplacedIds = new Set<string>()
const migrated = JSON.parse(input, (key, value) =>
	Migrations.updateIdInString(key, value, replacementMap, unreplacedIds)
)

await writeFile(outputPath, `${JSON.stringify(migrated, undefined, 2)}\n`)

if (unreplacedIds.size > 0) {
	console.warn(`Unreplaced IDs: ${Array.from(unreplacedIds).join(', ')}`)
}
