import { Command, Flags } from '@oclif/core'
import chalk from 'chalk'
import ora from 'ora'

import { AnalysisPipeline } from '../../core/pipeline.js'
import { formatDate } from '../../utils/time.js'
import { AnalysisResult } from '../../utils/types.js'

export default class AnalyzeToday extends Command {
  static override description = 'Analyze today\'s coding sessions and generate daily report'
static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --out ./reports',
    '<%= config.bin %> <%= command.id %> --provider openai --model gpt-4',
    '<%= config.bin %> <%= command.id %> --json',
  ]
static override flags = {
    json: Flags.boolean({
      char: 'j',
      description: 'Output results as JSON'
    }),
    model: Flags.string({
      char: 'm',
      description: 'Model name override'
    }),
    'no-redact': Flags.boolean({
      description: 'Disable content redaction'
    }),
    out: Flags.string({
      char: 'o',
      description: 'Output directory for reports'
    }),
    provider: Flags.string({
      char: 'p',
      description: 'LLM provider override',
      options: ['openai', 'anthropic', 'generic']
    })
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(AnalyzeToday)
    
    const today = new Date()
    const dateStr = formatDate(today)
    
    console.log(chalk.cyan(`🤖 Analyzing today's coding sessions (${dateStr})\n`))

    // Create analysis pipeline
    const spinner = ora('Initializing analysis pipeline...').start()
    
    try {
      const pipeline = await AnalysisPipeline.create()
      
      spinner.text = 'Collecting session data from Claude Code and Codex...'
      
      const result = await pipeline.analyzeDay(today, {
        enableRedaction: !flags['no-redact'],
        outputDir: flags.out
      })

      spinner.succeed('Analysis completed!')

      // Display results
      if (flags.json) {
        console.log(JSON.stringify(result, null, 2))
      } else {
        this.displayResults(result, flags.out)
      }

    } catch (error) {
      spinner.fail('Analysis failed')
      this.error(`Analysis failed: ${error}`)
    }
  }

  private displayResults(result: AnalysisResult, outputDir?: string): void {
    console.log(chalk.bold.cyan('\n📊 Analysis Summary'))
    console.log(`Date: ${chalk.yellow(result.date)}`)
    console.log(`Sessions: ${chalk.green(result.stats.totalSessions)}`)
    console.log(`Events: ${chalk.green(result.stats.totalEvents)}`)
    console.log(`Problems identified: ${chalk.green(result.stats.totalProblems)}`)

    if (result.sessions.length === 0) {
      console.log(chalk.yellow('\n⚠️  No coding sessions found for today.'))
      console.log(chalk.dim('Make sure you\'ve used Claude Code or Codex CLI today.'))
      return
    }

    // Display daily report preview
    console.log(chalk.bold.cyan('\n📋 Daily Report Preview:'))
    const reportLines = result.dailyReport.split('\n')
    const previewLines = reportLines.slice(0, 10)
    for (const line of previewLines) {
      console.log(chalk.dim(`  ${line}`))
    }
    
    if (reportLines.length > 10) {
      console.log(chalk.dim(`  ... (${reportLines.length - 10} more lines)`))
    }

    // Display knowledge preview
    console.log(chalk.bold.cyan('\n🧠 Knowledge Extraction Preview:'))
    const knowledgeLines = result.knowledge.split('\n')
    const knowledgePreview = knowledgeLines.slice(0, 8)
    for (const line of knowledgePreview) {
      console.log(chalk.dim(`  ${line}`))
    }
    
    if (knowledgeLines.length > 8) {
      console.log(chalk.dim(`  ... (${knowledgeLines.length - 8} more lines)`))
    }

    // Show sessions summary
    console.log(chalk.bold.cyan('\n💬 Sessions Summary:'))
    for (const [idx, session] of result.sessions.entries()) {
      const duration = Math.round((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / (1000 * 60))
      console.log(`  ${idx + 1}. ${chalk.yellow(session.project || 'Unknown project')} - ${chalk.green(session.events.length)} events (${duration}min)`)
    }

    if (outputDir) {
      console.log(chalk.bold.green(`\n✅ Reports saved to: ${outputDir}/${result.date}/`))
      console.log(chalk.dim(`  - daily.md`))
      console.log(chalk.dim(`  - knowledge.md`))
      console.log(chalk.dim(`  - data.json`))
    } else {
      console.log(chalk.dim('\nTip: Use --out <directory> to save reports to files'))
    }
  }
}