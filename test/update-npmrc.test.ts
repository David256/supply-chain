import { describe, test, expect } from 'bun:test'
import { NpmConfigReference } from '../src/types.js'
import { updateNpmrc } from '../src/lib/npmrc-checking.js'

describe.skip('Find the .npmrc file', () => {})

describe('Update .npmrc content', () => {
  const missingConfigContent = `# test config
this-config=4
`.trim()

  const fixConfigContent = `# test config
this-config=4
legacy-peer-deps=false
searchlimit=3
fetch-timeout=100000
`.trim()

  const noChangedContent = `# test config
this-config=4
legacy-peer-deps=true
scope=@cli
searchlimit=10
fetch-timeout=3000000
`.trim()

  const npmConfigReferences: NpmConfigReference[] = [
    {
      key: 'legacy-peer-deps',
      value: true,
    },
    {
      key: 'scope',
      value: '@cli',
    },
    {
      key: 'searchlimit',
      parser: (line, key, value) => {
        if (!Number.isNaN(value) || typeof value === 'undefined') {
          return 10
        }

        const digit = Number(value)
        if (digit < 10) {
          return 10
        }

        return value
      },
    },
    {
      key: 'fetch-timeout',
      parser: (line, key, value) => {
        if (!Number.isNaN(value) || typeof value === 'undefined') {
          return 3000000
        }

        const digit = Number(value)
        if (digit < 3000000) {
          return 3000000
        }

        return value
      },
    },
  ]

  test.each([
    [2, 6, 4, 0, missingConfigContent],
    [5, 6, 1, 3, fixConfigContent],
    [6, 6, 0, 0, noChangedContent],
  ])(
    'check config and fix - start with %i line and update to %i - added %i - modified %i',
    (
      currentLength: number,
      finalLength: number,
      addedCount: number,
      modifiedCount: number,
      content: string,
    ) => {
      expect(content.split('\n').length).toEqual(currentLength)
      const {
        content: updated,
        added,
        modified,
      } = updateNpmrc(content, npmConfigReferences)
      expect(
        updated.split('\n').length,
        JSON.stringify(updated.split('\n')),
      ).toEqual(finalLength)
      expect(updated).toInclude('legacy-peer-deps=true')
      expect(updated).toInclude('scope=@cli')
      expect(updated).toInclude('searchlimit=10')
      expect(updated).toInclude('fetch-timeout=3000000')

      expect(added.length, JSON.stringify(added)).toEqual(addedCount)
      expect(modified.length, JSON.stringify(modified)).toEqual(modifiedCount)

      expect(updated.includes('legacy-peer-deps=true')).toBeTrue()
      expect(updated.includes('searchlimit=10')).toBeTrue()
      expect(updated.includes('scope=@cli')).toBeTrue()
      expect(updated.includes('fetch-timeout=3000000')).toBeTrue()

      expect(updated.split('legacy-peer-deps=true').length - 1).toEqual(1)
      expect(updated.split('searchlimit=10').length - 1).toEqual(1)
      expect(updated.split('scope=@cli').length - 1).toEqual(1)
      expect(updated.split('fetch-timeout=3000000').length - 1).toEqual(1)
    },
  )
})
