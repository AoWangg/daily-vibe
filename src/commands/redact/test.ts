import { Args, Command } from '@oclif/core'
import chalk from 'chalk'

import { RedactionEngine } from '../../core/redact.js'
import { loadConfig } from '../../utils/config.js'

export default class RedactTest extends Command {
  static override args = {
    text: Args.string({
      description: 'Text to test redaction on (optional, will use sample data if not provided)'
    })
  }
static override description = 'Test redaction patterns on sample data'
static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> "Here is my API key: sk-1234567890abcdef"',
  ]

  async run(): Promise<void> {
    const { args } = await this.parse(RedactTest)
    
    console.log(chalk.cyan('🛡️  Testing data redaction patterns\n'))

    const config = await loadConfig()
    const engine = new RedactionEngine(config.redact)

    if (!config.redact?.enabled) {
      console.log(chalk.yellow('⚠️  Redaction is currently disabled in configuration'))
      console.log(chalk.dim('Enable with: daily-vibe config set --redact-enabled true\n'))
    }

    const testData = args.text ? [args.text] : this.getSampleTestData()

    for (const [i, text] of testData.entries()) {
      const result = engine.redact(text)

      console.log(chalk.bold(`Test ${i + 1}:`))
      console.log(chalk.dim('Original:'))
      console.log(`  ${text}\n`)
      
      console.log(chalk.dim('Redacted:'))
      console.log(`  ${result.redacted}\n`)

      if (result.matches.length > 0) {
        console.log(chalk.green(`✓ Found ${result.matches.length} sensitive item(s):`))
        for (const [idx, match] of result.matches.entries()) {
          console.log(`  ${idx + 1}. "${match.match}" → "${match.replacement}" (${chalk.dim(match.pattern)})`)
        }
      } else {
        console.log(chalk.gray('ℹ No sensitive patterns detected'))
      }
      
      console.log() // Empty line between tests
    }

    console.log(chalk.cyan('📋 Current redaction patterns:'))
    if (config.redact?.patterns && config.redact.patterns.length > 0) {
      for (const [idx, pattern] of config.redact.patterns.entries()) {
        console.log(`  ${idx + 1}. ${chalk.dim(pattern)}`)
      }
    } else {
      console.log(chalk.gray('  No patterns configured'))
    }
  }

  private getSampleTestData(): string[] {
    return [
      'Here is my OpenAI API key: sk-1234567890abcdefghijklmnopqrstuvwxyz123456',
      'Anthropic key: sk-ant-api03-1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz1234567890ab-cdef',
      'Please contact me at john.doe@example.com or call 555-123-4567',
      'GitHub token: ghp_1234567890abcdefghijklmnopqrstuvwx1234',
      'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      'My SSN is 123-45-6789 and my phone is 555.123.4567',
      'No sensitive data in this message, just normal text content.',
    ]
  }
}