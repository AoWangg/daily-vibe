import { Command, Flags } from '@oclif/core'
import chalk from 'chalk'

import { getConfigPath, loadConfig, updateLLMConfig } from '../../utils/config.js'
import { LLMConfig } from '../../utils/types.js'

export default class ConfigSet extends Command {
  static override description = 'Set configuration for LLM providers and other options'
static override examples = [
    '<%= config.bin %> <%= command.id %> --provider openai --api-key sk-...',
    '<%= config.bin %> <%= command.id %> --provider anthropic --api-key sk-ant-...',
    '<%= config.bin %> <%= command.id %> --provider generic --base-url http://localhost:1234/v1 --model gpt-4',
  ]
static override flags = {
    'api-key': Flags.string({
      char: 'k',
      description: 'API key for the provider'
    }),
    'base-url': Flags.string({
      char: 'u',
      description: 'Base URL for API (OpenAI compatible endpoints)'
    }),
    model: Flags.string({
      char: 'm',
      description: 'Model name to use'
    }),
    provider: Flags.string({
      char: 'p',
      description: 'LLM provider',
      options: ['openai', 'anthropic', 'generic']
    }),
    show: Flags.boolean({
      char: 's',
      description: 'Show current configuration'
    })
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(ConfigSet)

    if (flags.show) {
      await this.showConfig()
      return
    }

    const updates: Partial<LLMConfig> = {}

    if (flags.provider) {
      if (!['anthropic', 'generic', 'openai'].includes(flags.provider)) {
        this.error(`Invalid provider: ${flags.provider}. Must be one of: openai, anthropic, generic`)
      }

      updates.provider = flags.provider as 'anthropic' | 'generic' | 'openai'
    }

    if (flags['api-key']) {
      updates.apiKey = flags['api-key']
    }

    if (flags['base-url']) {
      if (!flags.provider || flags.provider === 'anthropic') {
        this.warn('Base URL is typically used with OpenAI or generic providers')
      }

      updates.baseUrl = flags['base-url']
    }

    if (flags.model) {
      updates.model = flags.model
    }

    if (Object.keys(updates).length === 0) {
      this.error('No configuration updates provided. Use --show to see current config.')
    }

    try {
      await updateLLMConfig(updates)
      console.log(chalk.green('✓ Configuration updated successfully'))
      
      // Show what was updated
      console.log(chalk.cyan('\nUpdated configuration:'))
      if (updates.provider) console.log(`  Provider: ${chalk.yellow(updates.provider)}`)
      if (updates.apiKey) console.log(`  API Key: ${chalk.yellow('***' + updates.apiKey.slice(-4))}`)
      if (updates.baseUrl) console.log(`  Base URL: ${chalk.yellow(updates.baseUrl)}`)
      if (updates.model) console.log(`  Model: ${chalk.yellow(updates.model)}`)
      
      console.log(chalk.dim(`\nConfig saved to: ${getConfigPath()}`))
    } catch (error) {
      this.error(`Failed to update configuration: ${error}`)
    }
  }

  private async showConfig(): Promise<void> {
    try {
      const config = await loadConfig()
      
      console.log(chalk.cyan('Current Configuration:'))
      console.log(chalk.dim(`Config file: ${getConfigPath()}\n`))
      
      console.log(chalk.bold('LLM Settings:'))
      console.log(`  Provider: ${chalk.yellow(config.llm.provider || 'not set')}`)
      
      if (config.llm.apiKey) {
        console.log(`  API Key: ${chalk.yellow('***' + config.llm.apiKey.slice(-4))}`)
      } else {
        console.log(`  API Key: ${chalk.red('not set')}`)
      }
      
      if (config.llm.baseUrl) {
        console.log(`  Base URL: ${chalk.yellow(config.llm.baseUrl)}`)
      }
      
      if (config.llm.model) {
        console.log(`  Model: ${chalk.yellow(config.llm.model)}`)
      }
      
      console.log(chalk.bold('\nOther Settings:'))
      console.log(`  Timezone: ${chalk.yellow(config.timezone || 'not set')}`)
      console.log(`  Output Directory: ${chalk.yellow(config.outputDir || 'not set')}`)
      console.log(`  Redaction Enabled: ${config.redact?.enabled ? chalk.green('Yes') : chalk.red('No')}`)
      
      if (config.redact?.patterns && config.redact.patterns.length > 0) {
        console.log(`  Redaction Patterns: ${chalk.yellow(config.redact.patterns.length)} configured`)
      }
    } catch (error) {
      this.error(`Failed to load configuration: ${error}`)
    }
  }
}