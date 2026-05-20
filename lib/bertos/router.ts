import type { AIModel, RouterDecision, TaskType, RoutingStrategy } from './types'

interface RoutingRule {
  patterns: RegExp[]
  taskType: TaskType
  primary: AIModel
  secondary?: AIModel[]
  strategy: RoutingStrategy
  reasoning: string
}

const ROUTING_RULES: RoutingRule[] = [
  {
    patterns: [
      /\b(code|function|bug|error|fix|implement|refactor|typescript|javascript|python|react|next|api|component|class|interface|algorithm)\b/i,
      /```/,
      /\b(debug|stack trace|undefined|null|exception|compile)\b/i,
    ],
    taskType: 'coding',
    primary: 'ollama-pro',
    secondary: ['codex-cli', 'claude-code'],
    strategy: 'single',
    reasoning: 'Coding tasks route to Ollama Pro (gpt-oss:120b-cloud). Enable Codex CLI for OpenAI-grade code generation.',
  },
  {
    patterns: [
      /\b(debug|why (is|does|did|won't|can't)|trace|fix this|what's wrong|broken)\b/i,
    ],
    taskType: 'debugging',
    primary: 'ollama-pro',
    secondary: ['codex-cli', 'claude-code'],
    strategy: 'single',
    reasoning: 'Debugging routes to Ollama Pro. Enable Codex CLI or Claude Code for additional model perspectives.',
  },
  {
    patterns: [
      /\b(write|essay|article|blog|story|summarize|explain|describe|draft)\b/i,
    ],
    taskType: 'writing',
    primary: 'ollama-pro',
    secondary: ['claude-code'],
    strategy: 'single',
    reasoning: 'Writing tasks route to Ollama Pro. Enable Claude Code CLI for Anthropic-quality prose.',
  },
  {
    patterns: [
      /\b(large|massive|entire|whole|full|complete|all of|entire document|pdf|book)\b/i,
      /\b(analyze this|process this|go through)\b/i,
    ],
    taskType: 'analysis',
    primary: 'ollama-pro',
    secondary: ['gemini-cli'],
    strategy: 'single',
    reasoning: 'Analysis routes to Ollama Pro. Enable Gemini CLI for large-context document analysis.',
  },
  {
    patterns: [
      /\b(brainstorm|ideas|creative|options|alternatives|what if|possibilities|suggest)\b/i,
    ],
    taskType: 'brainstorming',
    primary: 'ollama-pro',
    secondary: ['claude-code', 'gemini-cli'],
    strategy: 'single',
    reasoning: 'Brainstorming routes to Ollama Pro. Enable CLI providers for additional creative perspectives.',
  },
  {
    patterns: [
      /\b(research|find|search|information about|tell me about|what is|who is|when did|history)\b/i,
    ],
    taskType: 'research',
    primary: 'ollama-pro',
    secondary: ['gemini-cli'],
    strategy: 'single',
    reasoning: 'Research routes to Ollama Pro. Enable Gemini CLI for web-grounded knowledge.',
  },
  {
    patterns: [
      /\b(calculate|math|equation|formula|solve|compute|integral|derivative|probability)\b/i,
    ],
    taskType: 'math',
    primary: 'ollama-pro',
    secondary: ['claude-code'],
    strategy: 'single',
    reasoning: 'Math problems route to Ollama Pro. Enable Claude Code CLI for complex step-by-step solutions.',
  },
]

function classifyTask(prompt: string): { taskType: TaskType; rule: RoutingRule | null } {
  let bestRule: RoutingRule | null = null
  let bestScore = 0

  for (const rule of ROUTING_RULES) {
    let score = 0
    for (const pattern of rule.patterns) {
      if (pattern.test(prompt)) score++
    }
    if (score > bestScore) {
      bestScore = score
      bestRule = rule
    }
  }

  return {
    taskType: bestRule?.taskType ?? 'general',
    rule: bestRule,
  }
}

function computeConfidence(prompt: string, rule: RoutingRule | null): number {
  if (!rule) return 0.5
  let matched = 0
  for (const p of rule.patterns) {
    if (p.test(prompt)) matched++
  }
  return Math.min(0.95, 0.6 + (matched / rule.patterns.length) * 0.35)
}

export function routePrompt(prompt: string, preferredModel: AIModel): RouterDecision {
  if (preferredModel !== 'auto') {
    return {
      primary: preferredModel,
      reasoning: `Manually routed to ${preferredModel} as selected.`,
      confidence: 1.0,
      taskType: 'general',
      strategy: 'single',
    }
  }

  const { taskType, rule } = classifyTask(prompt)
  const confidence = computeConfidence(prompt, rule)

  if (!rule) {
    return {
      primary: 'ollama-pro',
      reasoning: 'General task — Ollama Pro is the default always-on subscription provider.',
      confidence: 0.5,
      taskType: 'general',
      strategy: 'single',
    }
  }

  return {
    primary: rule.primary,
    secondary: rule.secondary,
    reasoning: rule.reasoning,
    confidence,
    taskType,
    strategy: rule.strategy,
  }
}

export function getModelColor(model: string): string {
  switch (model) {
    case 'ollama-pro':      return '#F97316'
    case 'qwen2.5-coder':   return '#F97316'
    case 'llama3':          return '#F97316'
    case 'llama3.2':        return '#F97316'
    case 'mistral':         return '#EC4899'
    case 'deepseek-coder':  return '#06B6D4'
    case 'hermes3':         return '#A855F7'
    case 'claude-code':     return '#8B5CF6'
    case 'gemini-cli':      return '#3B82F6'
    case 'codex-cli':       return '#10B981'
    case 'claude-api':      return '#8B5CF6'
    case 'openai-api':      return '#10B981'
    case 'gemini-api':      return '#3B82F6'
    case 'hermes-agent':    return '#A855F7'
    case 'auto':            return '#F59E0B'
    default:                return '#6B7280'
  }
}

export function getModelLabel(model: string): string {
  switch (model) {
    case 'ollama-pro':      return 'Ollama Pro'
    case 'qwen2.5-coder':   return 'Qwen 2.5 Coder'
    case 'llama3':          return 'Llama 3'
    case 'llama3.2':        return 'Llama 3.2'
    case 'mistral':         return 'Mistral'
    case 'deepseek-coder':  return 'DeepSeek Coder'
    case 'hermes3':         return 'Hermes 3'
    case 'claude-code':     return 'Claude Code'
    case 'gemini-cli':      return 'Gemini CLI'
    case 'codex-cli':       return 'Codex CLI'
    case 'claude-api':      return 'Anthropic API'
    case 'openai-api':      return 'OpenAI API'
    case 'gemini-api':      return 'Gemini API'
    case 'hermes-agent':    return 'Hermes Agent'
    case 'auto':            return 'Auto'
    default:                return model
  }
}
