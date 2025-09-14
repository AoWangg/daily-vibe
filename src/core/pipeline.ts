import path from 'node:path'

import {collectClaudeCodeEvents} from '../sources/claude-code.js'
import {collectCodexEvents} from '../sources/codex.js'
import {loadConfig} from '../utils/config.js'
import {ensureDir, writeFile} from '../utils/fs.js'
import {formatDate, getDateRange, getDayRange} from '../utils/time.js'
import {AnalysisResult, AppConfig, SessionEvent, SessionSummary} from '../utils/types.js'
import {createLLMClient, LLMClient} from './llm.js'
import {RedactionEngine} from './redact.js'

export interface AnalyzeOptions {
  date?: Date
  dateRange?: {from: Date; to: Date}
  enableRedaction?: boolean
  outputDir?: string
}

export class AnalysisPipeline {
  private config: AppConfig
  private redactionEngine: RedactionEngine

  constructor(redactionEngine: RedactionEngine, config: AppConfig) {
    this.config = config
    this.redactionEngine = redactionEngine
  }

  static async create(): Promise<AnalysisPipeline> {
    const config = await loadConfig()
    const redactionEngine = new RedactionEngine(config.redact)
    return new AnalysisPipeline(redactionEngine, config)
  }

  async analyzeDateRange(from: Date, to: Date, options: AnalyzeOptions = {}): Promise<AnalysisResult> {
    const {end: rangeEnd, start: rangeStart} = getDateRange(from, to, this.config.timezone)

    // Collect events from all sources
    const [claudeResult, codexResult] = await Promise.all([
      collectClaudeCodeEvents({dayEnd: rangeEnd, dayStart: rangeStart}),
      collectCodexEvents({dayEnd: rangeEnd, dayStart: rangeStart}),
    ])

    // Combine all events
    const allEvents = [...claudeResult.events, ...codexResult.events]
    const allSessions = [...claudeResult.sessions, ...codexResult.sessions]

    // Apply redaction if enabled
    const processedSessions = options.enableRedaction === false ? allSessions : this.redactSessions(allSessions)

    // Split into chunks for analysis
    const chunks = this.splitSessionsIntoChunks(processedSessions)

    // Generate analysis using LLM with chunked approach (并行处理日报和知识库分析)
    const llmClient = createLLMClient(this.config.llm)
    const dateRangeStr = `${formatDate(from)} to ${formatDate(to)}`

    const [dailyReport, knowledge] = await Promise.all([
      this.generateChunkedAnalysis(chunks, 'daily', dateRangeStr, llmClient),
      this.generateChunkedAnalysis(chunks, 'knowledge', dateRangeStr, llmClient),
    ])

    const result: AnalysisResult = {
      dailyReport,
      date: dateRangeStr,
      knowledge,
      sessions: processedSessions,
      stats: {
        totalEvents: allEvents.length,
        totalProblems: this.extractProblemSolutions(processedSessions).length,
        totalSessions: allSessions.length,
      },
    }

    // Save to disk if output directory is specified
    if (options.outputDir) {
      await this.saveResults(result, options.outputDir, 'range')
    }

    return result
  }

  async analyzeDay(date: Date, options: AnalyzeOptions = {}): Promise<AnalysisResult> {
    const {end: dayEnd, start: dayStart} = getDayRange(date, this.config.timezone)

    // Collect events from all sources
    const [claudeResult, codexResult] = await Promise.all([
      collectClaudeCodeEvents({dayEnd, dayStart}),
      collectCodexEvents({dayEnd, dayStart}),
    ])

    // Combine all events
    const allEvents = [...claudeResult.events, ...codexResult.events]
    const allSessions = [...claudeResult.sessions, ...codexResult.sessions]

    // Apply redaction if enabled
    const processedSessions = options.enableRedaction === false ? allSessions : this.redactSessions(allSessions)

    // Split into chunks for analysis
    const chunks = this.splitSessionsIntoChunks(processedSessions)

    // Generate analysis using LLM with chunked approach (并行处理日报和知识库分析)
    const llmClient = createLLMClient(this.config.llm)
    const dateStr = formatDate(date)

    const [dailyReport, knowledge] = await Promise.all([
      this.generateChunkedAnalysis(chunks, 'daily', dateStr, llmClient),
      this.generateChunkedAnalysis(chunks, 'knowledge', dateStr, llmClient),
    ])

    const result: AnalysisResult = {
      dailyReport,
      date: dateStr,
      knowledge,
      sessions: processedSessions,
      stats: {
        totalEvents: allEvents.length,
        totalProblems: this.extractProblemSolutions(processedSessions).length,
        totalSessions: allSessions.length,
      },
    }

    // Save to disk if output directory is specified
    if (options.outputDir) {
      await this.saveResults(result, options.outputDir)
    }

    return result
  }

  private containsErrorPattern(content: string): boolean {
    const errorPatterns = [
      /error|exception|traceback|npm ERR!/i,
      /TypeError|ValueError|SyntaxError|ReferenceError/i,
      /panic|fatal|abort|crash/i,
      /failed|failure|unsuccessful/i,
      /cannot find|not found|undefined|null/i,
      /permission denied|access denied/i,
      /connection refused|timeout/i,
    ]

    return errorPatterns.some((pattern) => pattern.test(content))
  }

  private createDailyIntegrationPrompt(chunkAnalyses: string[], dateStr: string): string {
    return `请整合以下多个时段的开发日报分析，生成统一的日报：

日期：${dateStr}

分段分析结果：
${chunkAnalyses.map((analysis, index) => `## 时段 ${index + 1}：\n${analysis}\n`).join('\n---\n\n')}

请将这些分段分析整合成一份完整的开发日报，包括：
1. 整体概览（合并所有时段的主要工作）
2. 关键产出（去重并分类整理）
3. 运行测试（统计成功/失败情况）
4. 待办事项（合并并优先级排序）

保持原有的中文格式和Markdown结构。`
  }

  private createKnowledgeIntegrationPrompt(chunkAnalyses: string[], dateStr: string): string {
    return `请整合以下多个时段的知识库分析，生成统一的知识库：

日期：${dateStr}

分段分析结果：
${chunkAnalyses.map((analysis, index) => `## 时段 ${index + 1}：\n${analysis}\n`).join('\n---\n\n')}

请将这些分段分析整合成一份完整的知识库，包括：
1. 去重相似问题，保留最完整的解决方案
2. 按技术领域分类整理（构建/编译、工具配置、依赖管理等）
3. 提取通用规则和最佳实践
4. 合并相关的踩坑提示

保持原有的中文格式和Markdown结构。`
  }

  private estimateSessionLength(session: SessionSummary): number {
    const headerLength = 200 // session header基本信息
    const eventsLength = session.events.reduce((total, event) => total + (event.content?.length || 0) + 150, 0) // timestamp + role + formatting
    return headerLength + eventsLength
  }

  private extractProblemSolutions(sessions: SessionSummary[]): Array<{
    context: string;
    events: SessionEvent[];
    problem: string;
    solution: string;
  }> {
    const problems: Array<{
      context: string;
      events: SessionEvent[];
      problem: string;
      solution: string;
    }> = []

    for (const session of sessions) {
      const {events} = session

      for (let i = 0; i < events.length; i++) {
        const event = events[i]

        // Look for error patterns in user messages and tool outputs
        if (
          this.containsErrorPattern(event.content) ||
          (event.toolRuns && event.toolRuns.some((run) => run.error || run.exitCode !== 0))
        ) {
          // Look for subsequent assistant responses that might be solutions
          const solutionEvents = events.slice(i + 1, i + 5).filter((e) => e.role === 'assistant')

          if (solutionEvents.length > 0) {
            problems.push({
              context: session.project || 'unknown',
              events: [event, ...solutionEvents],
              problem: event.content,
              solution: solutionEvents.map((e) => e.content).join('\n'),
            })
          }
        }
      }
    }

    return problems
  }

  private formatSessionsForLLM(sessions: SessionSummary[]): string {
    const MAX_EVENT_CONTENT_LENGTH = 3000 // 单个事件内容最大长度

    return sessions
      .map((session) => {
        const {endTime, events, project, sessionId, startTime} = session
        const processedEvents = events
          .map((event) => {
            // 适度截断单个事件内容，保留重要信息
            let {content} = event
            if (content.length > MAX_EVENT_CONTENT_LENGTH) {
              content = content.slice(0, MAX_EVENT_CONTENT_LENGTH) + '... [内容过长已截断]'
            }

            let eventStr = `[${event.timestamp.toISOString()}] ${event.role}: ${content}`

            if (event.toolRuns && event.toolRuns.length > 0) {
              const toolSummary = event.toolRuns
                .map(
                  (run) => `${run.tool || run.command}: ${(run.output || run.error || 'executed').slice(0, 300)}`,
                )
                .join('; ')
              eventStr += `\n  Tools: ${toolSummary}`
            }

            return eventStr
          })
          .slice(0, 100) // 每个会话最多100个事件

        return `Session: ${sessionId} (${
          project || 'unknown project'
        })\nTime: ${startTime.toISOString()} - ${endTime.toISOString()}\n${processedEvents.join('\n')}\n---\n`
      })
      .join('\n')
  }

  private async generateChunkedAnalysis(
    chunks: SessionSummary[][],
    analysisType: 'daily' | 'knowledge',
    dateStr: string,
    llmClient: LLMClient,
  ): Promise<string> {
    if (chunks.length === 0) {
      return analysisType === 'daily'
        ? `# 开发日报 - ${dateStr}\n\n## 📊 概览\n没有找到编程会话记录。`
        : `# 知识库 - ${dateStr}\n\n## ℹ️ 说明\n没有找到可分析的问题和解决方案。`
    }

    if (chunks.length === 1) {
      // 只有一个chunk，直接分析
      const sessionSummary = this.formatSessionsForLLM(chunks[0])
      return analysisType === 'daily'
        ? llmClient.summarizeDaily(sessionSummary, dateStr)
        : llmClient.extractKnowledge(sessionSummary, dateStr)
    }

    // 多个chunks，并行分析然后整合
    console.log(`🔄 并行分析 ${chunks.length} 个数据块...`)

    // 并行分析所有chunks
    const chunkAnalysisPromises = chunks.map(async (chunk, index) => {
      const chunkSummary = this.formatSessionsForLLM(chunk)
      const chunkDateStr = `${dateStr} (第${index + 1}/${chunks.length}部分)`

      console.log(`   开始分析第 ${index + 1}/${chunks.length} 块...`)

      const analysis =
        analysisType === 'daily'
          ? await llmClient.summarizeDaily(chunkSummary, chunkDateStr)
          : await llmClient.extractKnowledge(chunkSummary, chunkDateStr)

      console.log(`   ✅ 完成第 ${index + 1}/${chunks.length} 块分析`)
      return analysis
    })

    // 等待所有分析完成
    const chunkAnalyses = await Promise.all(chunkAnalysisPromises)

    // 整合所有chunk的分析结果
    console.log(`🔗 整合分析结果...`)
    return this.integrateChunkAnalyses(chunkAnalyses, analysisType, dateStr, llmClient)
  }

  private async integrateChunkAnalyses(
    chunkAnalyses: string[],
    analysisType: 'daily' | 'knowledge',
    dateStr: string,
    llmClient: LLMClient,
  ): Promise<string> {
    const integrationPrompt =
      analysisType === 'daily'
        ? this.createDailyIntegrationPrompt(chunkAnalyses, dateStr)
        : this.createKnowledgeIntegrationPrompt(chunkAnalyses, dateStr)

    // 使用LLM整合所有分析结果
    return analysisType === 'daily'
      ? llmClient.summarizeDaily(integrationPrompt, dateStr)
      : llmClient.extractKnowledge(integrationPrompt, dateStr)
  }

  private redactSessions(sessions: SessionSummary[]): SessionSummary[] {
    return sessions.map((session) => ({
      ...session,
      events: session.events.map((event) => ({
        ...event,
        content: this.redactionEngine.redact(event.content).redacted,
        toolRuns: event.toolRuns?.map((run) => ({
          ...run,
          input: run.input ? this.redactionEngine.redact(run.input).redacted : run.input,
          output: run.output ? this.redactionEngine.redact(run.output).redacted : run.output,
        })),
      })),
    }))
  }

  private async saveResults(result: AnalysisResult, outputDir: string, prefix = ''): Promise<void> {
    const dirName = prefix ? `${prefix}-${result.date}` : result.date.replace(/\s+to\s+/, '_')
    const reportDir = path.join(outputDir, dirName)

    await ensureDir(reportDir)

    // Save daily report
    await writeFile(path.join(reportDir, 'daily.md'), result.dailyReport)

    // Save knowledge extraction
    await writeFile(path.join(reportDir, 'knowledge.md'), result.knowledge)

    // Save raw data as JSON
    await writeFile(path.join(reportDir, 'data.json'), JSON.stringify(result, null, 2))
  }

  private splitSessionsIntoChunks(sessions: SessionSummary[]): SessionSummary[][] {
    const MAX_CHUNK_LENGTH = 80_000 // 保守估计每个chunk的字符数限制
    const chunks: SessionSummary[][] = []
    let currentChunk: SessionSummary[] = []
    let currentChunkLength = 0

    for (const session of sessions) {
      // 估算session的文本长度
      const sessionLength = this.estimateSessionLength(session)

      // 如果当前chunk加上这个session超过限制，开始新chunk
      if (currentChunkLength + sessionLength > MAX_CHUNK_LENGTH && currentChunk.length > 0) {
        chunks.push(currentChunk)
        currentChunk = [session]
        currentChunkLength = sessionLength
      } else {
        currentChunk.push(session)
        currentChunkLength += sessionLength
      }
    }

    // 添加最后一个chunk
    if (currentChunk.length > 0) {
      chunks.push(currentChunk)
    }

    return chunks
  }
}
