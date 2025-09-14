import fastGlob from 'fast-glob'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'

const {glob} = fastGlob

export async function* readJsonl(file: string) {
  try {
    const rl = readline.createInterface({
      crlfDelay: Infinity,
      input: fs.createReadStream(file),
    })

    for await (const line of rl) {
      const s = line.trim()
      if (!s) continue
      try {
        yield JSON.parse(s)
      } catch {
        // Skip invalid JSON lines
      }
    }
  } catch {
    // File doesn't exist or can't be read, silently skip
  }
}

export async function findFiles(patterns: string[], cwd?: string): Promise<string[]> {
  try {
    return await glob(patterns, {
      absolute: true,
      cwd: cwd || os.homedir(),
      dot: true,
      onlyFiles: true,
    })
  } catch {
    return []
  }
}

export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.promises.mkdir(dirPath, {recursive: true})
  } catch {
    // Directory might already exist
  }
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  await ensureDir(path.dirname(filePath))
  await fs.promises.writeFile(filePath, content, 'utf8')
}

export function expandTilde(filePath: string): string {
  if (filePath.startsWith('~/')) {
    return path.join(os.homedir(), filePath.slice(2))
  }

  return filePath
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(expandTilde(filePath))
    return true
  } catch {
    return false
  }
}
