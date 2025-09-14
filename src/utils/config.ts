import { cosmiconfig } from 'cosmiconfig'
import os from 'node:os'
import path from 'node:path'

import { ensureDir, writeFile } from './fs.js'
import { AppConfig, LLMConfig } from './types.js'

const CONFIG_DIR = path.join(os.homedir(), '.daily-vibe')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')

const defaultConfig: AppConfig = {
  llm: {
    provider: 'openai'
  },
  outputDir: 'reports',
  redact: {
    enabled: true,
    patterns: [
      'sk-[a-zA-Z0-9]{48}', // OpenAI API keys
      'sk-ant-[a-zA-Z0-9-]{95}', // Anthropic API keys
      String.raw`[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}`, // Email addresses
      String.raw`\b\d{3}-\d{2}-\d{4}\b`, // SSN format
      String.raw`\b\d{3}[-.]?\d{3}[-.]?\d{4}\b`, // Phone numbers
      'ghp_[a-zA-Z0-9]{36}', // GitHub personal access tokens
      'Bearer [a-zA-Z0-9_=-]+', // Bearer tokens
    ]
  },
  timezone: 'Asia/Taipei'
}

export async function loadConfig(): Promise<AppConfig> {
  try {
    // Try to load from our direct config file first
    const fs = await import('node:fs')
    const configContent = await fs.promises.readFile(CONFIG_FILE, 'utf8')
    const config = JSON.parse(configContent)
    return mergeWithDefaults(config)
  } catch {
    // File doesn't exist or is invalid
  }

  // Fallback to cosmiconfig search
  const explorer = cosmiconfig('daily-vibe')
  
  try {
    const result = await explorer.search()
    if (result && result.config) {
      return mergeWithDefaults(result.config)
    }
  } catch {
    // Config file not found or invalid, use defaults
  }
  
  return defaultConfig
}

export async function saveConfig(config: Partial<AppConfig>): Promise<void> {
  const currentConfig = await loadConfig()
  const updatedConfig = { ...currentConfig, ...config }
  
  await ensureDir(CONFIG_DIR)
  await writeFile(CONFIG_FILE, JSON.stringify(updatedConfig, null, 2))
}

export async function updateLLMConfig(llmConfig: Partial<LLMConfig>): Promise<void> {
  const currentConfig = await loadConfig()
  const updatedConfig = {
    ...currentConfig,
    llm: { ...currentConfig.llm, ...llmConfig }
  }
  
  await saveConfig(updatedConfig)
}

function mergeWithDefaults(config: Partial<AppConfig>): AppConfig {
  return {
    llm: { ...defaultConfig.llm, ...config.llm },
    outputDir: config.outputDir || defaultConfig.outputDir,
    redact: {
      enabled: config.redact?.enabled ?? defaultConfig.redact!.enabled,
      patterns: config.redact?.patterns || defaultConfig.redact!.patterns
    },
    timezone: config.timezone || defaultConfig.timezone
  }
}

export function getConfigPath(): string {
  return CONFIG_FILE
}