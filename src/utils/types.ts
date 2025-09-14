export interface SessionEvent {
  content: string
  fileDiffs?: FileDiff[]
  id?: string
  metadata?: Record<string, unknown>
  project?: string
  role: 'assistant' | 'system' | 'tool' | 'user'
  sessionId?: string
  timestamp: Date
  toolRuns?: ToolRun[]
}

export interface ToolRun {
  command?: string
  error?: string
  exitCode?: number
  input?: string
  output?: string
  tool?: string
}

export interface FileDiff {
  after?: string
  before?: string
  content?: string
  file: string
  operation: 'create' | 'delete' | 'update'
}

export interface SessionSummary {
  endTime: Date
  events: SessionEvent[]
  problemSolutions?: ProblemSolution[]
  project?: string
  sessionId: string
  startTime: Date
}

export interface ProblemSolution {
  context: string
  events: SessionEvent[]
  problem: string
  solution: string
}

export interface AnalysisResult {
  dailyReport: string
  date: string
  knowledge: string
  sessions: SessionSummary[]
  stats: {
    totalEvents: number
    totalProblems: number
    totalSessions: number
  }
}

export interface DataSource {
  available: boolean
  description: string
  filesFound: number
  name: string
  paths: string[]
  type: 'claude-code' | 'codex-cli' | 'codex-vscode'
}

export interface LLMConfig {
  apiKey?: string
  baseUrl?: string
  model?: string
  provider: 'anthropic' | 'generic' | 'openai'
}

export interface AppConfig {
  llm: LLMConfig
  outputDir?: string
  redact?: {
    enabled: boolean
    patterns: string[]
  }
  timezone?: string
}