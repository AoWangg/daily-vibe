import { expandTilde, findFiles, readJsonl } from '../utils/fs.js'
import { isWithinRange, parseTimestamp } from '../utils/time.js'
import { SessionEvent, SessionSummary } from '../utils/types.js'

export interface ClaudeCodeOptions {
  dayEnd: Date
  dayStart: Date
}

export async function collectClaudeCodeEvents(options: ClaudeCodeOptions): Promise<{
  events: SessionEvent[]
  filesScanned: string[]
  sessions: SessionSummary[]
}> {
  const { dayEnd, dayStart } = options
  const allEvents: SessionEvent[] = []
  const filesScanned: string[] = []

  // Scan ~/.claude/projects/**/**/*.jsonl
  const claudeFiles = await findFiles(['projects/**/**/*.jsonl'], expandTilde('~/.claude'))
  filesScanned.push(...claudeFiles)

  for (const file of claudeFiles) {
    // eslint-disable-next-line no-await-in-loop
    for await (const event of readJsonl(file)) {
      const sessionEvent = parseClaudeCodeEvent(event, file)
      if (sessionEvent && isWithinRange(sessionEvent.timestamp, dayStart, dayEnd)) {
        allEvents.push(sessionEvent)
      }
    }
  }

  // Scan .specstory/history/** (if it exists in current working directory or any parent)
  const specstoryFiles = await findFiles(['**/.specstory/history/**/*.md', '**/.specstory/history/**/*.jsonl'])
  filesScanned.push(...specstoryFiles)

  for (const file of specstoryFiles) {
    if (file.endsWith('.jsonl')) {
      // eslint-disable-next-line no-await-in-loop
      for await (const event of readJsonl(file)) {
        const sessionEvent = parseSpecStoryEvent(event, file)
        if (sessionEvent && isWithinRange(sessionEvent.timestamp, dayStart, dayEnd)) {
          allEvents.push(sessionEvent)
        }
      }
    } else if (file.endsWith('.md')) {
      // Parse markdown conversation files
      // eslint-disable-next-line no-await-in-loop
      const events = await parseSpecStoryMarkdown(file, dayStart, dayEnd)
      allEvents.push(...events)
    }
  }

  // Group events into sessions
  const sessions = groupEventsIntoSessions(allEvents)

  return {
    events: allEvents,
    filesScanned,
    sessions
  }
}

function parseClaudeCodeEvent(event: any, filePath: string): null | SessionEvent { // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    const timestamp = parseTimestamp(event.timestamp || event.ts || event.time)
    if (!timestamp) return null

    // Extract session and project info from file path
    // Format: ~/.claude/projects/<project-hash>/<session-id>.jsonl
    const pathParts = filePath.split('/')
    const sessionId = pathParts.at(-1)?.replace('.jsonl', '')
    const project = pathParts.at(-2)

    // Determine role from event type and message role
    let role = 'user'
    if (event.type) {
      role = event.type
    } else if (event.message?.role) {
      role = event.message.role
    }

    return {
      content: extractContent(event),
      fileDiffs: parseFileDiffs(event.fileDiffs || event.file_diffs),
      id: event.uuid || event.id || `${sessionId}_${timestamp.getTime()}`,
      metadata: {
        cwd: event.cwd,
        filePath,
        gitBranch: event.gitBranch,
        source: 'claude-code',
        version: event.version
      },
      project,
      role: normalizeRole(role),
      sessionId,
      timestamp,
      toolRuns: parseToolRuns(event.toolRuns || event.tool_runs)
    }
  } catch (error) {
    console.error('Error parsing Claude Code event:', error)
    return null
  }
}

function parseSpecStoryEvent(event: any, filePath: string): null | SessionEvent { // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    const timestamp = parseTimestamp(event.timestamp || event.ts || event.time)
    if (!timestamp) return null

    return {
      content: extractContent(event),
      id: event.id || `specstory_${Date.now()}`,
      metadata: {
        filePath,
        source: 'specstory'
      },
      project: 'specstory',
      role: normalizeRole(event.role || event.type),
      sessionId: extractSessionIdFromPath(filePath),
      timestamp
    }
  } catch {
    return null
  }
}

async function parseSpecStoryMarkdown(filePath: string, dayStart: Date, dayEnd: Date): Promise<SessionEvent[]> {
  try {
    const fs = await import('node:fs')
    const content = await fs.promises.readFile(filePath, 'utf8')
    const events: SessionEvent[] = []

    // Simple markdown parsing - look for timestamp headers and content blocks
    const lines = content.split('\n')
    let currentTimestamp: Date | null = null
    let currentRole: null | string = null
    let currentContent = ''

    for (const line of lines) {
      // Look for timestamp patterns in headers
      const timestampMatch = line.match(/#{1,6}\s*.*?(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2})/)
      if (timestampMatch) {
        // Save previous event if exists
        if (currentTimestamp && currentRole && currentContent.trim() && isWithinRange(currentTimestamp, dayStart, dayEnd)) {
            events.push({
              content: currentContent.trim(),
              id: `md_${Date.now()}_${events.length}`,
              metadata: {
                filePath,
                source: 'specstory-md'
              },
              project: 'specstory',
              role: normalizeRole(currentRole),
              sessionId: extractSessionIdFromPath(filePath),
              timestamp: currentTimestamp
            })
          }

        currentTimestamp = parseTimestamp(timestampMatch[1])
        currentContent = ''
      }

      // Look for role indicators
      if (line.toLowerCase().includes('user:') || line.toLowerCase().includes('human:')) {
        currentRole = 'user'
      } else if (line.toLowerCase().includes('assistant:') || line.toLowerCase().includes('claude:')) {
        currentRole = 'assistant'
      }

      currentContent += line + '\n'
    }

    // Save last event
    if (currentTimestamp && currentRole && currentContent.trim() && isWithinRange(currentTimestamp, dayStart, dayEnd)) {
        events.push({
          content: currentContent.trim(),
          id: `md_${Date.now()}_${events.length}`,
          metadata: {
            filePath,
            source: 'specstory-md'
          },
          project: 'specstory',
          role: normalizeRole(currentRole),
          sessionId: extractSessionIdFromPath(filePath),
          timestamp: currentTimestamp
        })
      }

    return events
  } catch {
    return []
  }
}

function normalizeRole(role: string): 'assistant' | 'system' | 'tool' | 'user' {
  const normalized = role?.toLowerCase() || ''
  if (normalized.includes('user') || normalized.includes('human')) return 'user'
  if (normalized.includes('assistant') || normalized.includes('claude')) return 'assistant'
  if (normalized.includes('tool')) return 'tool'
  if (normalized.includes('system') || normalized.includes('summary')) return 'system'
  return 'user' // Default for Claude Code
}

function extractContent(event: any): string { // eslint-disable-line @typescript-eslint/no-explicit-any
  // Handle Claude Code message structure
  if (event.message) {
    // For user messages: event.message.content is string
    if (typeof event.message.content === 'string') {
      return event.message.content
    }
    
    // For assistant messages: event.message.content is array
    if (Array.isArray(event.message.content)) {
      return event.message.content.map((item: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        if (item.type === 'text') {
          return item.text
        }

 if (item.type === 'tool_use') {
          return `[Tool: ${item.name}] ${JSON.stringify(item.input, null, 2)}`
        }

 if (item.type === 'tool_result') {
          return `[Tool Result] ${item.content}`
        }

        return JSON.stringify(item)
      }).join('\n')
    }
    
    // Fallback for other message formats
    return JSON.stringify(event.message)
  }
  
  // Handle tool results
  if (event.toolUseResult) {
    return `[Tool Result] ${JSON.stringify(event.toolUseResult, null, 2)}`
  }
  
  // Handle summary events
  if (event.type === 'summary' && event.summary) {
    return `[Session Summary] ${event.summary}`
  }
  
  // Fallback to simple extraction
  return event.content || event.text || event.data || JSON.stringify(event)
}

function parseToolRuns(toolRuns: any): any[] { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!Array.isArray(toolRuns)) return []
  return toolRuns.map(run => ({
    command: run.command,
    error: run.error,
    exitCode: run.exitCode || run.exit_code,
    input: run.input || run.parameters,
    output: run.output || run.result,
    tool: run.tool || run.name
  }))
}

function parseFileDiffs(fileDiffs: any): any[] { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!Array.isArray(fileDiffs)) return []
  return fileDiffs.map(diff => ({
    after: diff.after,
    before: diff.before,
    content: diff.content,
    file: diff.file || diff.path,
    operation: diff.operation || diff.type
  }))
}

function extractSessionIdFromPath(filePath: string): string {
  const parts = filePath.split('/')
  return parts.at(-1)?.replace(/\.(jsonl|md)$/, '') || 'unknown'
}

function groupEventsIntoSessions(events: SessionEvent[]): SessionSummary[] {
  const sessionMap = new Map<string, SessionEvent[]>()

  // Group events by sessionId
  for (const event of events) {
    const sessionId = event.sessionId || 'unknown'
    if (!sessionMap.has(sessionId)) {
      sessionMap.set(sessionId, [])
    }

    sessionMap.get(sessionId)!.push(event)
  }

  // Convert to session summaries
  return [...sessionMap.entries()].map(([sessionId, sessionEvents]) => {
    sessionEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    
    return {
      endTime: sessionEvents.at(-1)?.timestamp || new Date(),
      events: sessionEvents,
      project: sessionEvents[0]?.project,
      sessionId,
      startTime: sessionEvents[0]?.timestamp || new Date()
    }
  })
}