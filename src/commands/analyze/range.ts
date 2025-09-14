import { Command, Flags } from '@oclif/core'
import chalk from 'chalk'
import dayjs from 'dayjs'
import ora from 'ora'

import { AnalysisPipeline } from '../../core/pipeline.js'
import { formatDate } from '../../utils/time.js'
import { AnalysisResult, SessionSummary } from '../../utils/types.js'

export default class AnalyzeRange extends Command {
  static override description = 'Analyze coding sessions within a custom date range'
static override examples = [
    '<%= config.bin %> <%= command.id %> --from 2025-09-01 --to 2025-09-13',
    '<%= config.bin %> <%= command.id %> --from 2025-09-01 --to 2025-09-13 --out ./reports',
    '<%= config.bin %> <%= command.id %> --from "2025-09-01" --to "today" --json',
  ]
static override flags = {
    from: Flags.string({
      char: 'f',
      description: 'Start date (YYYY-MM-DD format)',
      required: true
    }),
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
    }),
    to: Flags.string({
      char: 't',
      description: 'End date (YYYY-MM-DD format)',
      required: true
    })
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(AnalyzeRange)
    
    // Parse dates
    const fromDate = this.parseDate(flags.from)
    const toDate = this.parseDate(flags.to)
    
    if (!fromDate || !toDate) {
      this.error('Invalid date format. Use YYYY-MM-DD format.')
    }
    
    if (fromDate > toDate) {
      this.error('Start date must be before end date.')
    }

    const fromStr = formatDate(fromDate)
    const toStr = formatDate(toDate)
    const dayCount = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
    
    console.log(chalk.cyan(`🤖 Analyzing coding sessions from ${fromStr} to ${toStr} (${dayCount} days)\n`))

    // Create analysis pipeline
    const spinner = ora('Initializing analysis pipeline...').start()
    
    try {
      const pipeline = await AnalysisPipeline.create()
      
      spinner.text = 'Collecting session data from Claude Code and Codex...'
      
      const result = await pipeline.analyzeDateRange(fromDate, toDate, {
        enableRedaction: !flags['no-redact'],
        outputDir: flags.out
      })

      spinner.succeed('Analysis completed!')

      // Display results
      if (flags.json) {
        console.log(JSON.stringify(result, null, 2))
      } else {
        this.displayResults(result, flags.out, dayCount)
      }

    } catch (error) {
      spinner.fail('Analysis failed')
      this.error(`Analysis failed: ${error}`)
    }
  }

  private displayResults(result: AnalysisResult, outputDir?: string, dayCount?: number): void {
    console.log(chalk.bold.cyan('\n📊 Analysis Summary'))
    console.log(`Date Range: ${chalk.yellow(result.date)}`)
    
    if (dayCount) {
      console.log(`Days Analyzed: ${chalk.green(dayCount)}`)
    }
    
    console.log(`Sessions: ${chalk.green(result.stats.totalSessions)}`)
    console.log(`Events: ${chalk.green(result.stats.totalEvents)}`)
    console.log(`Problems identified: ${chalk.green(result.stats.totalProblems)}`)

    if (result.sessions.length === 0) {
      console.log(chalk.yellow('\n⚠️  No coding sessions found in the specified date range.'))
      console.log(chalk.dim('Make sure you\'ve used Claude Code or Codex CLI during this period.'))
      return
    }

    // Calculate daily averages
    const avgSessionsPerDay = dayCount ? (result.stats.totalSessions / dayCount).toFixed(1) : 'N/A'
    const avgEventsPerDay = dayCount ? (result.stats.totalEvents / dayCount).toFixed(1) : 'N/A'
    
    console.log(chalk.bold.cyan('\n📈 Daily Averages:'))
    console.log(`  Sessions per day: ${chalk.green(avgSessionsPerDay)}`)
    console.log(`  Events per day: ${chalk.green(avgEventsPerDay)}`)

    // Display daily report preview
    console.log(chalk.bold.cyan('\n📋 Summary Report Preview:'))
    const reportLines = result.dailyReport.split('\n')
    const previewLines = reportLines.slice(0, 15)
    for (const line of previewLines) {
      console.log(chalk.dim(`  ${line}`))
    }
    
    if (reportLines.length > 15) {
      console.log(chalk.dim(`  ... (${reportLines.length - 15} more lines)`))
    }

    // Display knowledge preview
    console.log(chalk.bold.cyan('\n🧠 Knowledge Extraction Preview:'))
    const knowledgeLines = result.knowledge.split('\n')
    const knowledgePreview = knowledgeLines.slice(0, 10)
    for (const line of knowledgePreview) {
      console.log(chalk.dim(`  ${line}`))
    }
    
    if (knowledgeLines.length > 10) {
      console.log(chalk.dim(`  ... (${knowledgeLines.length - 10} more lines)`))
    }

    // Show sessions summary (top 5 by event count)
    console.log(chalk.bold.cyan('\n💬 Top Sessions by Activity:'))
    const topSessions = result.sessions
      .sort((a: SessionSummary, b: SessionSummary) => b.events.length - a.events.length)
      .slice(0, 5)
      
    for (const [idx, session] of topSessions.entries()) {
      const startDate = formatDate(new Date(session.startTime))
      const duration = Math.round((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / (1000 * 60))
      console.log(`  ${idx + 1}. ${chalk.yellow(session.project || 'Unknown project')} - ${chalk.green(session.events.length)} events (${duration}min) - ${startDate}`)
    }

    if (result.sessions.length > 5) {
      console.log(chalk.dim(`  ... and ${result.sessions.length - 5} more sessions`))
    }

    if (outputDir) {
      const dirName = `range-${result.date.replace(/\s+to\s+/, '_')}`
      console.log(chalk.bold.green(`\n✅ Reports saved to: ${outputDir}/${dirName}/`))
      console.log(chalk.dim(`  - daily.md`))
      console.log(chalk.dim(`  - knowledge.md`))
      console.log(chalk.dim(`  - data.json`))
    } else {
      console.log(chalk.dim('\nTip: Use --out <directory> to save reports to files'))
    }
  }

  private parseDate(dateStr: string): Date | null {
    // Handle "today" special case
    if (dateStr.toLowerCase() === 'today') {
      return new Date()
    }
    
    // Handle "yesterday" special case  
    if (dateStr.toLowerCase() === 'yesterday') {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      return yesterday
    }
    
    // Parse standard date formats
    const parsed = dayjs(dateStr)
    if (!parsed.isValid()) {
      return null
    }
    
    return parsed.toDate()
  }
}