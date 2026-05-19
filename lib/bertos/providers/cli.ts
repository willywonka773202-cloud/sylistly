import type { ProviderId } from './types'

/** The shell command name for each CLI subscription provider. */
export const CLI_COMMANDS: Record<ProviderId, string | undefined> = {
  'claude-code': 'claude',
  'gemini-cli':  'gemini',
  'codex-cli':   'codex',
  'ollama':      undefined,
  'claude-api':  undefined,
  'openai-api':  undefined,
  'gemini-api':  undefined,
}

/** User-facing setup instructions for each CLI provider. */
export const CLI_SETUP: Record<string, { install: string; login: string }> = {
  'claude-code': {
    install: 'npm install -g @anthropic-ai/claude-code',
    login:   'claude login',
  },
  'gemini-cli': {
    install: 'npm install -g @google/gemini-cli',
    login:   'gemini auth login',
  },
  'codex-cli': {
    install: 'npm install -g @openai/codex',
    login:   'codex login',
  },
}
