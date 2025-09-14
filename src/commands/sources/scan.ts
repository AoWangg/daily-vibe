import { Command } from '@oclif/core'
import chalk from 'chalk'
import os from 'node:os'
import path from 'node:path'

import { expandTilde, fileExists, findFiles } from '../../utils/fs.js'
import { DataSource } from '../../utils/types.js'

export default class SourcesScan extends Command {
  static override description = 'Scan and list available data sources'
static override examples = [
    '<%= config.bin %> <%= command.id %>'
  ]

  async run(): Promise<void> {
    console.log(chalk.cyan('🔍 Scanning for available data sources...\n'))

    const sources = await this.scanAllSources()

    for (const source of sources) {
      this.displaySourceInfo(source)
    }

    const availableSources = sources.filter(s => s.available)
    const totalFiles = availableSources.reduce((sum, s) => sum + s.filesFound, 0)

    console.log(chalk.yellow('\n📊 Summary:'))
    console.log(`  Available sources: ${chalk.green(availableSources.length)}/${sources.length}`)
    console.log(`  Total files found: ${chalk.green(totalFiles)}`)

    if (availableSources.length === 0) {
      console.log(chalk.red('\n⚠️  No data sources found. Make sure Claude Code or Codex CLI have been used.'))
    }
  }

  private displaySourceInfo(source: DataSource): void {
    const status = source.available ? chalk.green('✓ Available') : chalk.red('✗ Not found')
    const fileCount = source.available ? chalk.cyan(`(${source.filesFound} files)`) : chalk.gray('(0 files)')

    console.log(`${status} ${chalk.bold(source.name)} ${fileCount}`)
    console.log(`  ${chalk.gray(source.description)}`)
    
    if (source.available && source.paths.length > 0) {
      console.log(`  ${chalk.gray('Paths:')}`)
      for (const p of source.paths) {
        console.log(`    ${chalk.dim(p)}`)
      }
    }
    
    console.log() // Empty line between sources
  }

  private async scanAllSources(): Promise<DataSource[]> {
    const sources: DataSource[] = []

    // Scan Claude Code sources
    const claudeCodeProjects = await this.scanClaudeCodeProjects()
    const specStoryHistory = await this.scanSpecStoryHistory()

    // Scan Codex CLI sources
    const codexSessions = await this.scanCodexSessions()
    const codexHistory = await this.scanCodexHistory()

    // Scan VS Code Codex extension
    const codexVSCode = await this.scanCodexVSCode()

    sources.push(claudeCodeProjects, specStoryHistory, codexSessions, codexHistory, codexVSCode)

    return sources
  }

  private async scanClaudeCodeProjects(): Promise<DataSource> {
    const basePath = expandTilde('~/.claude')
    const available = await fileExists(basePath)
    let files: string[] = []
    
    if (available) {
      files = await findFiles(['projects/**/**/*.jsonl'], basePath)
    }

    return {
      available: available && files.length > 0,
      description: 'Claude Code session files stored by project',
      filesFound: files.length,
      name: 'Claude Code Projects',
      paths: [path.join(basePath, 'projects/**/**/*.jsonl')],
      type: 'claude-code'
    }
  }

  private async scanCodexHistory(): Promise<DataSource> {
    const basePath = expandTilde('~/.codex')
    const available = await fileExists(basePath)
    let files: string[] = []
    
    if (available) {
      files = await findFiles(['history/**/*.jsonl'], basePath)
    }

    return {
      available: available && files.length > 0,
      description: 'Codex CLI conversation history',
      filesFound: files.length,
      name: 'Codex CLI History',
      paths: [path.join(basePath, 'history/**/*.jsonl')],
      type: 'codex-cli'
    }
  }

  private async scanCodexSessions(): Promise<DataSource> {
    const basePath = expandTilde('~/.codex')
    const available = await fileExists(basePath)
    let files: string[] = []
    
    if (available) {
      files = await findFiles(['sessions/**/*.jsonl'], basePath)
    }

    return {
      available: available && files.length > 0,
      description: 'Codex CLI active session files',
      filesFound: files.length,
      name: 'Codex CLI Sessions',
      paths: [path.join(basePath, 'sessions/**/*.jsonl')],
      type: 'codex-cli'
    }
  }

  private async scanCodexVSCode(): Promise<DataSource> {
    const platform = os.platform()
    let globalStoragePath: string
    let files: string[] = []

    switch (platform) {
      case 'darwin': { // macOS
        globalStoragePath = path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'globalStorage')
        break
      }

      case 'linux': { // Linux
        globalStoragePath = path.join(os.homedir(), '.config', 'Code', 'User', 'globalStorage')
        break
      }

      case 'win32': { // Windows
        globalStoragePath = path.join(os.homedir(), 'AppData', 'Roaming', 'Code', 'User', 'globalStorage')
        break
      }

      default: {
        globalStoragePath = ''
      }
    }

    const available = globalStoragePath ? await fileExists(globalStoragePath) : false
    
    if (available) {
      const extensionPatterns = [
        '**/openai*codex*/**/*.jsonl',
        '**/openai*chatgpt*/**/*.jsonl',
        '**/codex*/**/*.jsonl'
      ]
      files = await findFiles(extensionPatterns, globalStoragePath)
    }

    return {
      available: available && files.length > 0,
      description: 'VS Code Codex extension storage',
      filesFound: files.length,
      name: 'VS Code Codex Extension',
      paths: [path.join(globalStoragePath, '**/*codex*/**/*.jsonl')],
      type: 'codex-vscode'
    }
  }

  private async scanSpecStoryHistory(): Promise<DataSource> {
    // Search for .specstory directories in current working directory and parents
    const files = await findFiles(['**/.specstory/history/**/*.md', '**/.specstory/history/**/*.jsonl'])
    
    return {
      available: files.length > 0,
      description: 'SpecStory conversation history files',
      filesFound: files.length,
      name: 'SpecStory History',
      paths: ['**/.specstory/history/**'],
      type: 'claude-code'
    }
  }
}