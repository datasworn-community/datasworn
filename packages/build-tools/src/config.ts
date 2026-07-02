import { readFile } from 'node:fs/promises'
import path from 'node:path'
import YAML from 'yaml'

import type { MultiPackageBuildConfig } from './content-package-builder.js'
import type { RulesPackageBuildConfig } from './rules-package-builder.js'

export type DataswornBuildConfig =
	| RulesPackageBuildConfig
	| MultiPackageBuildConfig

export async function readBuildConfig(
	configPath: string
): Promise<DataswornBuildConfig> {
	const text = await readFile(configPath, 'utf8')
	const ext = path.extname(configPath)
	const value = ext === '.json' ? JSON.parse(text) : YAML.parse(text)

	return value as DataswornBuildConfig
}
