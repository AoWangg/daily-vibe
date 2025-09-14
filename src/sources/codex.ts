import os from 'node:os'
import path from 'node:path'

import { expandTilde, findFiles, readJsonl } from '../utils/fs.js'
import { isWithinRange, parseTimestamp } from '../utils/time.js'
import { SessionEvent, SessionSummary } from '../utils/types.js'

export interface CodexOptions {
  dayEnd: Date
  dayStart: Date
}

export async function collectCodexEvents(options: CodexOptions): Promise<{
  events: SessionEvent[]
  filesScanned: string[]
  sessions: SessionSummary[]
}> {
  const { dayEnd, dayStart } = options
  const allEvents: SessionEvent[] = []
  const filesScanned: string[] = []

  // Scan ~/.codex/sessions/**/*.jsonl
  const sessionFiles = await findFiles(['sessions/**/*.jsonl'], expandTilde('~/.codex'))
  filesScanned.push(...sessionFiles)

  for (const file of sessionFiles) {
    // eslint-disable-next-line no-await-in-loop
    for await (const event of readJsonl(file)) {
      const sessionEvent = parseCodexEvent(event, file, 'sessions')
      if (sessionEvent && isWithinRange(sessionEvent.timestamp, dayStart, dayEnd)) {
        allEvents.push(sessionEvent)
      }
    }
  }

  // Scan ~/.codex/history/**/*.jsonl
  const historyFiles = await findFiles(['history/**/*.jsonl'], expandTilde('~/.codex'))
  filesScanned.push(...historyFiles)

  for (const file of historyFiles) {
    // eslint-disable-next-line no-await-in-loop
    for await (const event of readJsonl(file)) {
      const sessionEvent = parseCodexEvent(event, file, 'history')
      if (sessionEvent && isWithinRange(sessionEvent.timestamp, dayStart, dayEnd)) {
        allEvents.push(sessionEvent)
      }
    }
  }

  // Scan VS Code globalStorage for Codex extension (optional)
  const vsCodeEvents = await collectCodexVSCodeEvents(dayStart, dayEnd)
  allEvents.push(...vsCodeEvents.events)
  filesScanned.push(...vsCodeEvents.filesScanned)

  // Group events into sessions
  const sessions = groupEventsIntoSessions(allEvents)

  return {
    events: allEvents,
    filesScanned,
    sessions
  }
}

async function collectCodexVSCodeEvents(dayStart: Date, dayEnd: Date): Promise<{
  events: SessionEvent[]
  filesScanned: string[]
}> {
  const events: SessionEvent[] = []
  const filesScanned: string[] = []

  try {
    // VS Code globalStorage path on different platforms
    const platform = os.platform()
    let globalStoragePath: string

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
        return { events, filesScanned }
      }
    }

    // Look for OpenAI/Codex related extensions
    const extensionPatterns = [
      '**/openai*codex*/**/*.jsonl',
      '**/openai*chatgpt*/**/*.jsonl',
      '**/codex*/**/*.jsonl'
    ]

    const extensionFiles = await findFiles(extensionPatterns, globalStoragePath)
    filesScanned.push(...extensionFiles)

    for (const file of extensionFiles) {
      // eslint-disable-next-line no-await-in-loop
      for await (const event of readJsonl(file)) {
        const sessionEvent = parseCodexVSCodeEvent(event, file)
        if (sessionEvent && isWithinRange(sessionEvent.timestamp, dayStart, dayEnd)) {
          events.push(sessionEvent)
        }
      }
    }
  } catch {
    // VS Code or extensions not found, skip silently
  }

  return { events, filesScanned }
}

function parseCodexEvent(event: any, filePath: string, source: 'history' | 'sessions'): null | SessionEvent { // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    const timestamp = parseTimestamp(event.timestamp || event.ts || event.time || event.created_at)
    if (!timestamp) return null

    // Extract session info from file path
    const sessionId = extractSessionIdFromPath(filePath)

    return {
      content: extractContent(event),
      fileDiffs: parseFileDiffs(event.file_changes || event.diffs),
      id: event.id || event.message_id || `codex_${sessionId}_${Date.now()}`,
      metadata: {
        filePath,
        model: event.model,
        source: `codex-${source}`,
        tokens: event.tokens || event.usage
      },
      project: event.project || extractProjectFromPath(filePath),
      role: normalizeRole(event.role || event.type || 'user'),
      sessionId,
      timestamp,
      toolRuns: parseToolRuns(event.tools || event.tool_calls)
    }
  } catch {
    return null
  }
}

function parseCodexVSCodeEvent(event: any, filePath: string): null | SessionEvent { // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    const timestamp = parseTimestamp(event.timestamp || event.ts || event.time || event.created_at)
    if (!timestamp) return null

    const sessionId = extractSessionIdFromPath(filePath)

    return {
      content: extractContent(event),
      id: event.id || event.message_id || `vscode_${sessionId}_${Date.now()}`,
      metadata: {
        file: event.activeFile,
        filePath,
        source: 'codex-vscode',
        workspace: event.workspace
      },
      project: 'vscode',
      role: normalizeRole(event.role || event.type || 'user'),
      sessionId,
      timestamp,
      toolRuns: parseToolRuns(event.tools || event.tool_calls)
    }
  } catch {
    return null
  }
}

function normalizeRole(role: string): 'assistant' | 'system' | 'tool' | 'user' {
  const normalized = role?.toLowerCase() || ''
  if (normalized.includes('user') || normalized.includes('human')) return 'user'
  if (normalized.includes('assistant') || normalized.includes('bot') || normalized.includes('ai')) return 'assistant'
  if (normalized.includes('tool') || normalized.includes('function')) return 'tool'
  if (normalized.includes('system')) return 'system'
  return 'user' // Default for Codex
}

function extractContent(event: any): string { // eslint-disable-line @typescript-eslint/no-explicit-any
  // Try different content fields common in Codex
  return event.content || 
         event.message || 
         event.prompt || 
         event.text || 
         event.query ||
         event.response ||
         (event.choices && event.choices[0]?.text) ||
         JSON.stringify(event)
}

function parseToolRuns(tools: any): any[] { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!Array.isArray(tools)) return []
  
  return tools.map(tool => ({
    command: tool.command || tool.name,
    error: tool.error || tool.stderr,
    exitCode: tool.exit_code || tool.status,
    input: tool.input || tool.parameters || tool.arguments,
    output: tool.output || tool.result || tool.response,
    tool: tool.type || tool.function?.name
  }))
}

function parseFileDiffs(fileDiffs: any): any[] { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!Array.isArray(fileDiffs)) return []
  
  return fileDiffs.map(diff => ({
    after: diff.after || diff.new_content,
    before: diff.before || diff.old_content,
    content: diff.content || diff.new_content,
    file: diff.file || diff.filename || diff.path,
    operation: diff.operation || diff.action || diff.type
  }))
}

function extractSessionIdFromPath(filePath: string): string {
  const parts = filePath.split('/')
  const filename = parts.at(-1)?.replace('.jsonl', '') || 'unknown'
  
  // If the filename looks like a session ID or timestamp, use it
  if (/^[0-9a-f-]+$/i.test(filename) || /^\d{4}-\d{2}-\d{2}/.test(filename)) {
    return filename
  }
  
  // Otherwise use the parent directory name
  return parts.at(-2) || filename
}

function extractProjectFromPath(filePath: string): string | undefined {
  const parts = filePath.split('/')
  
  // Look for project indicators in path
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i]
    if (part && !part.includes('.jsonl') && part !== 'sessions' && part !== 'history' && part !== '.codex') {
      return part
    }
  }
  
  return undefined
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