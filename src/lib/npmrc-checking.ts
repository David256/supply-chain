import path from 'path'
import fs from 'fs'
import { NpmConfig, NpmConfigReference } from '../types.js'

const NPM_RC_FILENAME = '.npmrc'

export function findNpmrcPath() {
  const homeDir = process.env.HOME || process.env.USERPROFILE

  if (homeDir) {
    const userNpmrcPath = path.join(homeDir, NPM_RC_FILENAME)
    console.info(`[INFO] checking path: ${userNpmrcPath}`)

    try {
      if (fs.existsSync(userNpmrcPath)) {
        return userNpmrcPath
      }
    } catch (err) {
      console.warn(`[WARN] cannot check the path: ${err}`)
    }
  }

  const currentDirNpmrcPath = path.join(process.cwd(), NPM_RC_FILENAME)
  console.info(`[INFO] checking the local path: ${currentDirNpmrcPath}`)
  if (fs.existsSync(currentDirNpmrcPath)) {
    return currentDirNpmrcPath
  }

  return null
}

export function parseIniValue(value: string): string | number | boolean {
  const trimmed = value.trim()

  if (trimmed === 'true') return true
  if (trimmed === 'false') return false

  if (!Number.isNaN(Number(trimmed)) && trimmed !== '') {
    return Number(trimmed)
  }

  return trimmed
}

export function stringifyIniValue(value: number | string | boolean) {
  if (typeof value === 'string') {
    return value.includes('\n') ? `"${value.replace(/"/g, '\\"')}"` : value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  throw new TypeError('Unsupported value type')
}

export function splitIniLine(line: string): NpmConfig {
  const match = line.match(/^([^=]+?)\s*=\s*(.*)$/)

  if (!match) {
    throw new Error('Invalid INI line')
  }

  return {
    key: match[1].trim(),
    value: parseIniValue(match[2]),
  }
}

export function updateNpmrc(
  content: string,
  references: NpmConfigReference[],
): { content: string; added: NpmConfig[]; modified: NpmConfig[] } {
  const lines = content.split('\n')

  const processingLineOrConfig: (string | NpmConfig)[] = []
  const appliedReferenceKeys: string[] = []

  const addedOnes: NpmConfig[] = []
  const modifiedOnes: NpmConfig[] = []

  lines.forEach((line) => {
    if (!line.trim()) {
      processingLineOrConfig.push(line)
      return
    }

    let config: NpmConfig
    try {
      config = splitIniLine(line)
    } catch {
      console.warn(`[WARN] ignore unknown line: ${line}`)
      processingLineOrConfig.push(line)
      return
    }

    const reference = references.find((each) => each.key === config.key)
    if (typeof reference === 'undefined') {
      processingLineOrConfig.push(line)
      return
    }

    const value =
      typeof reference?.parser === 'function'
        ? reference.parser(line, config.key, config.value)
        : reference.value

    if (typeof value === 'undefined') {
      processingLineOrConfig.push(line)
      return
    }

    const modifiedConfig = {
      key: config.key,
      value: value,
    }
    processingLineOrConfig.push(modifiedConfig)
    if (config.value !== value) {
      modifiedOnes.push(modifiedConfig)
    }
    appliedReferenceKeys.push(reference.key)
  })

  const fixedLines = processingLineOrConfig.map((configOrLine) => {
    if (typeof configOrLine === 'string') {
      return configOrLine
    }

    const modified = `${configOrLine.key}=${stringifyIniValue(configOrLine.value)}`
    return modified
  })

  const missingConfigs = references
    .map((reference) => {
      if (appliedReferenceKeys.includes(reference.key)) {
        // ignore applied references
        return
      }

      // build a new config line
      const value =
        typeof reference.parser === 'function'
          ? reference.parser(undefined, undefined, undefined)
          : reference.value
      if (typeof value !== 'undefined') {
        const config: NpmConfig = {
          key: reference.key,
          value: value,
        }

        addedOnes.push(config)

        return `${config.key}=${stringifyIniValue(config.value)}`
      }
    })
    .filter((each) => typeof each === 'string')

  const newContent = [...fixedLines, ...missingConfigs].join('\n')

  return {
    content: newContent,
    added: addedOnes,
    modified: modifiedOnes,
  }
}
