import { getOllamaConfig } from '../runtime'
import { DEFAULT_PROVIDER_MODEL, LOCAL_FALLBACK_MODEL } from './registry'

/** Maps BertOS model aliases to the actual Ollama model tag. */
export function resolveOllamaModel(alias: string): string {
  const map: Record<string, string> = {
    'ollama-pro':     DEFAULT_PROVIDER_MODEL,
    'qwen2.5-coder':  LOCAL_FALLBACK_MODEL,
    'llama3':         'llama3',
    'llama3.2':       'llama3.2',
    'mistral':        'mistral',
    'deepseek-coder': 'deepseek-coder',
    'hermes3':        'hermes3',
  }
  return map[alias] ?? alias
}

/** Returns the Ollama base URL (reads runtime config — safe for server-side use only). */
export function resolveOllamaBase(customEndpoint?: string): string {
  if (customEndpoint?.trim()) return customEndpoint.trim()
  const cfg = getOllamaConfig()
  return cfg.baseUrl
}

/** All model aliases that resolve to the Ollama provider. */
export const OLLAMA_MODEL_ALIASES = new Set([
  'ollama-pro', 'qwen2.5-coder', 'llama3', 'llama3.2',
  'mistral', 'deepseek-coder', 'hermes3',
])

/** All model aliases that are CLI subscription providers. */
export const CLI_MODEL_ALIASES = new Set([
  'claude-code', 'gemini-cli', 'codex-cli',
])

/** All model aliases that are optional API providers (disabled by default). */
export const API_MODEL_ALIASES = new Set([
  'claude-api', 'openai-api', 'gemini-api',
])
