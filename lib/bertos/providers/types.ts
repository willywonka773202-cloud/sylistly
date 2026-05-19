export type ProviderKind = 'ollama' | 'cli-subscription' | 'api-optional'
export type BillingMode = 'subscription' | 'local' | 'api'
export type ProviderId =
  | 'ollama'
  | 'claude-code'
  | 'gemini-cli'
  | 'codex-cli'
  | 'claude-api'
  | 'openai-api'
  | 'gemini-api'

export interface ProviderHealth {
  available: boolean
  authenticated?: boolean
  latency?: number
  message?: string
  version?: string
  models?: string[]
}

export interface ProviderDefinition {
  id: ProviderId
  name: string
  kind: ProviderKind
  billingMode: BillingMode
  defaultModel: string
  localFallbackModel?: string
  description: string
  billingWarning?: string
  setupCommand: string
  docsUrl: string
  models: string[]
  color: string
}
