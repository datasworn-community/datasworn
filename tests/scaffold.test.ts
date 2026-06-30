import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dir, '..')
const sourceCommit = 'b27bc91c25039f23a72ffc061d6e2394f779643e'

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(path.join(root, relativePath), 'utf8'))
}

function readText(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8')
}

describe('Ticket 1.0 scaffold', () => {
  test('declares only publishable package workspaces', () => {
    const manifest = readJson('package.json') as {
      private: boolean
      workspaces: string[]
    }

    expect(manifest.private).toBe(true)
    expect(manifest.workspaces).toEqual(['packages/core', 'packages/build-tools'])
  })

  test('scaffolds the core and build-tools packages', () => {
    const core = readJson('packages/core/package.json') as {
      name: string
      private?: boolean
    }
    const buildTools = readJson('packages/build-tools/package.json') as {
      name: string
      private?: boolean
      dependencies: Record<string, string>
    }

    expect(core.name).toBe('@datasworn-community/core')
    expect(core.private).toBeUndefined()
    expect(buildTools.name).toBe('@datasworn-community/build-tools')
    expect(buildTools.private).toBeUndefined()
    expect(buildTools.dependencies['@datasworn-community/core']).toBe('workspace:*')
  })

  test('wires caller workflows to the pinned shared workflows', () => {
    for (const workflow of ['build', 'release', 'experimental-release']) {
      const workflowText = readText(`.github/workflows/${workflow}.yml`)
      expect(workflowText).toContain(
        `uses: datasworn-community/.github/.github/workflows/${workflow}.yml@v1`
      )
    }
  })

  test('records upstream provenance before implementation imports', () => {
    const provenance = readText('PROVENANCE.md')
    const notice = readText('NOTICE.md')

    expect(provenance).toContain('rsek')
    expect(provenance).toContain('tbsvttr/datasworn')
    expect(provenance).toContain(sourceCommit)
    expect(provenance).toContain('does not import upstream')
    expect(provenance).toContain('implementation files or game content')
    expect(notice).toContain('clean-history community continuation')
  })

  test('does not include official or community content in the core repo scaffold', () => {
    expect(existsSync(path.join(root, 'source_data'))).toBe(false)
    expect(existsSync(path.join(root, 'packages/official-content'))).toBe(false)
    expect(existsSync(path.join(root, 'packages/community-content'))).toBe(false)
  })
})
