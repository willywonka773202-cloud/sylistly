export type BertOSDeploymentMode = 'local' | 'cloud'

export function getBertOSDeploymentMode(): BertOSDeploymentMode {
  const explicit = process.env.BERTOS_DEPLOYMENT_MODE
  if (explicit === 'local' || explicit === 'cloud') return explicit
  if (process.env.VERCEL) return 'cloud'
  if (process.env.NODE_ENV === 'production') return 'cloud'
  return 'local'
}

export interface OllamaConfig {
  mode: BertOSDeploymentMode
  providerName: string
  baseUrl: string
  chatUrl: string
  tagsUrl: string | null
  defaultModel: string
  localFallback: string
  requiresApiKey: boolean
  apiKey: string
}

export function getOllamaConfig(): OllamaConfig {
  const mode = getBertOSDeploymentMode()
  const defaultModel = process.env.OLLAMA_DEFAULT_MODEL || 'gpt-oss:120b-cloud'
  const localFallback = process.env.OLLAMA_LOCAL_FALLBACK || 'qwen2.5-coder:latest'

  if (mode === 'cloud') {
    return {
      mode,
      providerName: 'Ollama Cloud',
      baseUrl: 'https://ollama.com',
      chatUrl: 'https://ollama.com/api/chat',
      tagsUrl: null,
      defaultModel,
      localFallback,
      requiresApiKey: true,
      apiKey: process.env.OLLAMA_API_KEY || '',
    }
  }

  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434'
  return {
    mode,
    providerName: 'Ollama Local',
    baseUrl,
    chatUrl: `${baseUrl}/api/chat`,
    tagsUrl: `${baseUrl}/api/tags`,
    defaultModel,
    localFallback,
    requiresApiKey: false,
    apiKey: '',
  }
}
