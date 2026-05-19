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
    primary: 'codex',
    secondary: ['claude'],
    strategy: 'sequential',
    reasoning: 'Coding tasks route to Codex for implementation, with Claude for architecture review.',
  },
  {
    patterns: [
      /\b(debug|why (is|does|did|won't|can't)|trace|fix this|what's wrong|broken)\b/i,
    ],
    taskType: 'debugging',
    primary: 'codex',
    secondary: ['claude', 'gemini'],
    strategy: 'parallel',
    reasoning: 'Complex debugging benefits from multiple AI perspectives simultaneously.',
  },
  {
    patterns: [
      /\b(write|essay|article|blog|story|summarize|explain|describe|draft)\b/i,
    ],
    taskType: 'writing',
    primary: 'claude',
    strategy: 'single',
    reasoning: 'Claude excels at long-form writing, nuanced explanation, and structured content.',
  },
  {
    patterns: [
      /\b(large|massive|entire|whole|full|complete|all of|entire document|pdf|book)\b/i,
      /\b(analyze this|process this|go through)\b/i,
    ],
    taskType: 'analysis',
    primary: 'gemini',
    secondary: ['claude'],
    strategy: 'sequential',
    reasoning: 'Gemini handles massive context windows best for document analysis.',
  },
  {
    patterns: [
      /\b(brainstorm|ideas|creative|options|alternatives|what if|possibilities|suggest)\b/i,
    ],
    taskType: 'brainstorming',
    primary: 'gemini',
    secondary: ['claude'],
    strategy: 'parallel',
    reasoning: 'Parallel brainstorming from Gemini + Claude yields the widest ideation.',
  },
  {
    patterns: [
      /\b(research|find|search|information about|tell me about|what is|who is|when did|history)\b/i,
    ],
    taskType: 'research',
    primary: 'gemini',
    secondary: ['claude'],
    strategy: 'sequential',
    reasoning: 'Gemini has strong web-grounded knowledge for research tasks.',
  },
  {
    patterns: [
      /\b(calculate|math|equation|formula|solve|compute|integral|derivative|probability)\b/i,
    ],
    taskType: 'math',
    primary: 'claude',
    secondary: ['codex'],
    strategy: 'single',
    reasoning: 'Claude has strong mathematical reasoning with clear step-by-step solutions.',
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
      primary: 'claude',
      reasoning: 'General task — Claude is the default for balanced, high-quality responses.',
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

export function getModelColor(model: AIModel): string {
  switch (model) {
    case 'claude':         return '#8B5CF6'
    case 'codex':          return '#10B981'
    case 'gemini':         return '#3B82F6'
    case 'auto':           return '#F59E0B'
    case 'llama3':         return '#F97316'
    case 'llama3.2':       return '#F97316'
    case 'mistral':        return '#EC4899'
    case 'deepseek-coder': return '#06B6D4'
    case 'hermes3':        return '#A855F7'
    default:               return '#6B7280'
  }
}

export function getModelLabel(model: AIModel): string {
  switch (model) {
    case 'claude':         return 'Claude'
    case 'codex':          return 'Codex'
    case 'gemini':         return 'Gemini'
    case 'auto':           return 'Auto'
    case 'llama3':         return 'Llama 3'
    case 'llama3.2':       return 'Llama 3.2'
    case 'mistral':        return 'Mistral'
    case 'deepseek-coder': return 'DeepSeek Coder'
    case 'hermes3':        return 'Hermes 3'
    default:               return model
  }
}
