export type OllamaModel = 'llama3.2' | 'mistral' | 'deepseek-coder' | 'hermes3'
export type AIModel = 'claude' | 'codex' | 'gemini' | 'auto' | OllamaModel

export type MessageRole = 'user' | 'assistant' | 'system'

export interface Message {
  id: string
  role: MessageRole
  content: string
  model?: AIModel
  timestamp: number
  streaming?: boolean
  routerDecision?: RouterDecision
  metadata?: {
    tokens?: number
    latency?: number
    confidence?: number
  }
}

export interface RouterDecision {
  primary: AIModel
  secondary?: AIModel[]
  reasoning: string
  confidence: number
  taskType: TaskType
  strategy: RoutingStrategy
}

export type TaskType =
  | 'coding'
  | 'analysis'
  | 'writing'
  | 'brainstorming'
  | 'debugging'
  | 'research'
  | 'math'
  | 'general'

export type RoutingStrategy = 'single' | 'parallel' | 'sequential' | 'best-of'

export interface ChatSession {
  id: string
  title: string
  messages: Message[]
  model: AIModel
  createdAt: number
  updatedAt: number
  projectId?: string
  pinned?: boolean
}

export interface Project {
  id: string
  name: string
  description: string
  color: string
  icon: string
  createdAt: number
  updatedAt: number
  sessions: string[]
  files: ProjectFile[]
  todos: Todo[]
  pinned: boolean
  context: string
}

export interface ProjectFile {
  id: string
  name: string
  type: string
  size: number
  content?: string
  uploadedAt: number
}

export interface Todo {
  id: string
  text: string
  done: boolean
  createdAt: number
}

export interface AgentTask {
  id: string
  title: string
  description: string
  status: 'pending' | 'running' | 'paused' | 'done' | 'failed'
  model: AIModel
  progress: number
  logs: AgentLog[]
  createdAt: number
  updatedAt: number
  projectId?: string
  checkpoints: AgentCheckpoint[]
}

export interface AgentLog {
  id: string
  timestamp: number
  level: 'info' | 'warn' | 'error' | 'success'
  message: string
}

export interface AgentCheckpoint {
  id: string
  timestamp: number
  description: string
  state: Record<string, unknown>
}

export interface CompareSession {
  id: string
  prompt: string
  responses: CompareResponse[]
  createdAt: number
  winner?: AIModel
}

export interface CompareResponse {
  model: AIModel
  content: string
  streaming: boolean
  latency?: number
  rank?: number
}

export interface CLIStatus {
  name: 'claude' | 'codex' | 'gemini'
  available: boolean
  version?: string
  path?: string
}

export interface BertOSSettings {
  theme: 'dark' | 'darker' | 'midnight'
  primaryModel: AIModel
  routingEnabled: boolean
  streamingEnabled: boolean
  memoryEnabled: boolean
  cliPaths: {
    claude?: string
    codex?: string
    gemini?: string
  }
  apiKeys: {
    anthropic?: string
    openai?: string
    google?: string
    ollama?: string
  }
  modelPriority: AIModel[]
  tokenBudget: number
  animationsEnabled: boolean
}
