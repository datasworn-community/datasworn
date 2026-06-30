#!/usr/bin/env node
import { existsSync } from 'node:fs'

import { readBuildConfig } from '../config.js'
import {
	buildRulesPackage,
	type RulesPackageBuildConfig
} from '../rules-package-builder.js'
import { hasArg, readArg } from './args.js'

function usage(): never {
	console.error(`Usage:
  datasworn-build --config datasworn.config.json
  datasworn-build --id my_rules --type ruleset --source source_data/my_rules --out-dir datasworn`)
	process.exit(1)
}

const args = process.argv.slice(2)
if (hasArg(args, '--help') || hasArg(args, '-h')) usage()

const configPath = readArg(args, '--config')
let config: RulesPackageBuildConfig

if (configPath != null) {
	if (!existsSync(configPath)) throw new Error(`Config file not found: ${configPath}`)
	config = await readBuildConfig(configPath)
} else {
	const id = readArg(args, '--id')
	const type = readArg(args, '--type') as RulesPackageBuildConfig['type']
	const source = readArg(args, '--source')
	const outDir = readArg(args, '--out-dir')

	if (id == null || type == null || source == null) usage()
	config = { id, type, source, outDir }
}

const result = await buildRulesPackage(config)
console.log(`Built ${config.id} from ${result.files.length} file(s): ${result.outFile}`)
