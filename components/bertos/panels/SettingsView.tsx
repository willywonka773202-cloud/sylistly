'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Settings, Key, Globe, Zap, Sparkles, Monitor, Database,
  Shield, Sliders, Check, Eye, EyeOff, Bot, Server, Cpu, Terminal,
  RefreshCw, Wifi, WifiOff
} from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import { useUIStore } from '@/store/bertos/ui'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { BertOSSettings } from '@/lib/bertos/types'

interface OllamaStatus {
  online: boolean
  mode: 'local' | 'cloud'
  provider: string
  baseUrl: string
  chatUrl: string
  defaultModel: string
  models: Array<{ name: string; type?: string; recommended?: boolean }>
  error?: string
  testResult?: { success: boolean; error?: string }
}

const SECTIONS = [
  { id: 'providers',  icon: Bot,      label: 'Providers'     },
  { id: 'api-keys',   icon: Key,      label: 'API Keys'      },
  { id: 'appearance', icon: Monitor,  label: 'Appearance'    },
  { id: 'memory',     icon: Database, label: 'Memory'        },
  { id: 'performance',icon: Sliders,  label: 'Performance'   },
  { id: 'security',   icon: Shield,   label: 'Security'      },
  { id: 'hermes',     icon: Bot,      label: 'Hermes Agent'  },
  { id: 'composio',   icon: Globe,    label: 'Composio'      },
]

function ToggleSwitch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={cn(
        'relative w-9 h-5 rounded-full transition-all duration-200',
        value ? 'bg-violet-600' : 'bg-zinc-700'
      )}
    >
      <div className={cn(
        'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200',
        value ? 'left-4' : 'left-0.5'
      )} />
    </button>
  )
}

function SecretInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 focus-within:border-zinc-700 transition-colors">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-700 outline-none font-mono"
      />
      <button onClick={() => setShow(!show)} className="text-zinc-600 hover:text-zinc-400 transition-colors">
        {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </div>
  )
}

interface HermesConnectionResult {
  online: boolean
  version?: string
  error?: string
}

interface ComposioConnectionResult {
  connected: boolean
  apps?: string[]
  error?: string
}

export function SettingsView() {
  const { settings, updateSettings } = useUIStore()
  const [activeSection, setActiveSection] = useState('providers')
  const [saved, setSaved] = useState(false)
  const [anthropicKey, setAnthropicKey] = useState((settings.apiKeys ?? {}).anthropic ?? '')
  const [openaiKey, setOpenaiKey] = useState((settings.apiKeys ?? {}).openai ?? '')
  const [googleKey, setGoogleKey] = useState((settings.apiKeys ?? {}).google ?? '')
  const [ollamaCloudKey, setOllamaCloudKey] = useState((settings.apiKeys ?? {}).ollamaCloud ?? '')
  const [ollamaEndpoint, setOllamaEndpoint] = useState(settings.ollamaEndpoint ?? '')
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null)
  const [ollamaLoading, setOllamaLoading] = useState(false)
  const [testingCloud, setTestingCloud] = useState(false)

  // Hermes
  const [hermesUrl, setHermesUrl] = useState(settings.hermesUrl ?? '')
  const [hermesApiKey, setHermesApiKey] = useState(settings.hermesApiKey ?? '')
  const [hermesStatus, setHermesStatus] = useState<HermesConnectionResult | null>(null)
  const [hermesLoading, setHermesLoading] = useState(false)

  // Composio
  const [composioKey, setComposioKey] = useState((settings.apiKeys as Record<string, string | undefined>).composio ?? '')
  const [composioStatus, setComposioStatus] = useState<ComposioConnectionResult | null>(null)
  const [composioLoading, setComposioLoading] = useState(false)

  const fetchOllamaStatus = async (testCloud = false) => {
    setOllamaLoading(true)
    if (testCloud) setTestingCloud(true)
    try {
      const params = new URLSearchParams()
      if (testCloud) params.set('testCloud', 'true')
      if (ollamaCloudKey) params.set('key', ollamaCloudKey)
      const url = `/api/ollama/status${params.size ? '?' + params.toString() : ''}`
      const res = await fetch(url)
      const data = await res.json() as OllamaStatus
      setOllamaStatus(data)
    } catch {
      setOllamaStatus(null)
    } finally {
      setOllamaLoading(false)
      setTestingCloud(false)
    }
  }

  useEffect(() => {
    if (activeSection === 'providers') {
      fetchOllamaStatus()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection])

  const saveSettings = () => {
    updateSettings({
      apiKeys: {
        anthropic: anthropicKey,
        openai: openaiKey,
        google: googleKey,
        ollamaCloud: ollamaCloudKey,
        ...(composioKey ? { composio: composioKey } : {}),
      } as BertOSSettings['apiKeys'],
      ollamaEndpoint: ollamaEndpoint.trim() || undefined,
      hermesUrl: hermesUrl.trim() || undefined,
      hermesApiKey: hermesApiKey.trim() || undefined,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const testHermesConnection = async () => {
    setHermesLoading(true)
    setHermesStatus(null)
    try {
      const params = new URLSearchParams()
      if (hermesUrl) params.set('url', hermesUrl)
      if (hermesApiKey) params.set('key', hermesApiKey)
      const res = await fetch(`/api/hermes/status?${params}`)
      const data = await res.json() as HermesConnectionResult
      setHermesStatus(data)
    } catch (err) {
      setHermesStatus({ online: false, error: err instanceof Error ? err.message : 'Connection failed' })
    } finally {
      setHermesLoading(false)
    }
  }

  const testComposioConnection = async () => {
    setComposioLoading(true)
    setComposioStatus(null)
    try {
      const params = new URLSearchParams()
      if (composioKey) params.set('key', composioKey)
      const res = await fetch(`/api/composio/status?${params}`)
      const data = await res.json() as ComposioConnectionResult
      setComposioStatus(data)
    } catch (err) {
      setComposioStatus({ connected: false, error: err instanceof Error ? err.message : 'Connection failed' })
    } finally {
      setComposioLoading(false)
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Section nav */}
      <div className="w-48 flex-shrink-0 border-r border-zinc-800/50 p-3 space-y-0.5">
        <p className="px-2 py-1 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Settings</p>
        {SECTIONS.map(section => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={cn(
              'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all duration-150',
              activeSection === section.id
                ? 'bg-violet-500/15 text-violet-300 border border-violet-500/20'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5 border border-transparent'
            )}
          >
            <section.icon className={cn('w-3.5 h-3.5', activeSection === section.id && 'text-violet-400')} />
            <span className="text-xs font-medium">{section.label}</span>
          </button>
        ))}
      </div>

      {/* Settings content */}
      <ScrollArea className="flex-1">
        <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">

          {/* ── Providers ─────────────────────────────────────────────────── */}
          {activeSection === 'providers' && (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-zinc-200 mb-1">Subscription Providers</h3>
                <p className="text-xs text-zinc-500">BertOS routes through providers you already subscribe to — no separate API billing required.</p>
              </div>

              {/* Always-on: Ollama Pro */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Always-On Default</h4>

                {/* Live Ollama status card */}
                <div className={cn(
                  'flex items-start gap-3 p-3.5 rounded-xl border',
                  ollamaStatus?.online
                    ? 'border-orange-500/20 bg-orange-500/5'
                    : ollamaStatus
                      ? 'border-red-500/20 bg-red-500/5'
                      : 'border-zinc-800 bg-zinc-900/30'
                )}>
                  <Bot className={cn('w-4 h-4 flex-shrink-0 mt-0.5', ollamaStatus?.online ? 'text-orange-400' : ollamaStatus ? 'text-red-400' : 'text-zinc-600')} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-zinc-200">Ollama Pro</p>
                      <span className="text-[10px] text-zinc-600">
                        {ollamaStatus ? `${ollamaStatus.provider} · ${ollamaStatus.mode}` : 'Checking…'}
                      </span>
                    </div>
                    {ollamaStatus ? (
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {ollamaStatus.defaultModel} · No API billing ·{' '}
                        <code className="text-zinc-600 text-[10px]">{ollamaStatus.chatUrl}</code>
                      </p>
                    ) : (
                      <p className="text-xs text-zinc-600 mt-0.5">Loading status…</p>
                    )}
                    {ollamaStatus?.mode === 'cloud' && (
                      <p className="text-[11px] text-zinc-600 mt-1">
                        Used for deployed BertOS on Vercel. Requires <code className="text-zinc-500">OLLAMA_API_KEY</code> in Vercel environment variables.
                      </p>
                    )}
                    {ollamaStatus?.mode === 'local' && (
                      <p className="text-[11px] text-zinc-600 mt-1">
                        Used for local development. Requires Ollama running on this computer (<code className="text-zinc-500">ollama serve</code>).
                      </p>
                    )}
                    {ollamaStatus?.error && (
                      <p className="text-[11px] text-red-400/80 mt-1">{ollamaStatus.error}</p>
                    )}
                    {ollamaStatus?.testResult && (
                      <p className={cn('text-[11px] mt-1', ollamaStatus.testResult.success ? 'text-emerald-400' : 'text-red-400')}>
                        {ollamaStatus.testResult.success
                          ? 'Connection test passed'
                          : `Connection test failed: ${ollamaStatus.testResult.error}`}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => fetchOllamaStatus(false)}
                        disabled={ollamaLoading}
                        className="flex items-center gap-1 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className={cn('w-3 h-3', ollamaLoading && !testingCloud && 'animate-spin')} />
                        Refresh
                      </button>
                      {ollamaStatus?.mode === 'cloud' && (
                        <button
                          onClick={() => fetchOllamaStatus(true)}
                          disabled={ollamaLoading}
                          className="flex items-center gap-1 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors disabled:opacity-50"
                        >
                          <Wifi className={cn('w-3 h-3', testingCloud && 'animate-pulse')} />
                          Test Connection
                        </button>
                      )}
                    </div>
                  </div>
                  {ollamaLoading && !testingCloud ? (
                    <RefreshCw className="w-3.5 h-3.5 text-zinc-600 animate-spin flex-shrink-0" />
                  ) : ollamaStatus?.online ? (
                    <Badge variant="success" className="text-[9px] h-4 flex-shrink-0">Connected</Badge>
                  ) : ollamaStatus ? (
                    <Badge variant="error" className="text-[9px] h-4 flex-shrink-0">Offline</Badge>
                  ) : (
                    <Badge variant="default" className="text-[9px] h-4 flex-shrink-0">Checking</Badge>
                  )}
                </div>

                {/* Ollama Cloud API key (shown in cloud mode or always as optional override) */}
                {ollamaStatus?.mode === 'cloud' || !ollamaStatus?.online ? (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-orange-400" />
                      <p className="text-sm font-medium text-zinc-300">Ollama Cloud API Key</p>
                      <Badge variant={ollamaCloudKey ? 'success' : 'warning'} className="text-[9px] h-4 ml-auto">
                        {ollamaCloudKey ? 'Set' : 'Required'}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-zinc-600 leading-relaxed">
                      Your Ollama API key from{' '}
                      <span className="text-zinc-500 font-mono">ollama.com/settings/api-keys</span>.
                      Saved locally in your browser — never sent to BertOS servers.
                      You can also set <code className="text-zinc-500">OLLAMA_API_KEY</code> in Vercel environment variables.
                    </p>
                    <SecretInput
                      value={ollamaCloudKey}
                      onChange={setOllamaCloudKey}
                      placeholder="ollama_..."
                    />
                    <Button onClick={saveSettings} size="sm" variant="outline" className="h-7 text-xs">
                      {saved ? <><Check className="w-3 h-3" /> Saved</> : 'Save Key'}
                    </Button>
                  </div>
                ) : null}

                {/* Ollama endpoint config (local mode only, or for override) */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-orange-400" />
                    <p className="text-sm font-medium text-zinc-300">Custom Ollama Endpoint</p>
                    <Badge variant={ollamaEndpoint ? 'success' : 'default'} className="text-[9px] h-4 ml-auto">
                      {ollamaEndpoint ? 'Custom' : 'Auto-detected'}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-zinc-600 leading-relaxed">
                    Override the Ollama endpoint. Leave blank to use auto-detection (cloud or local based on deployment mode).
                  </p>
                  <input
                    type="url"
                    value={ollamaEndpoint}
                    onChange={e => setOllamaEndpoint(e.target.value)}
                    placeholder="http://your-server:11434"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-700 outline-none focus:border-zinc-700 font-mono"
                  />
                  {ollamaEndpoint && (
                    <button
                      onClick={() => setOllamaEndpoint('')}
                      className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
                    >
                      Clear — revert to auto-detected endpoint
                    </button>
                  )}
                </div>
              </div>

              {/* CLI subscription providers */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">CLI Subscription Providers</h4>
                <p className="text-[11px] text-zinc-600">These use your existing AI subscriptions via local CLI tools. No API billing.</p>
                {([
                  {
                    id: 'claude-code', label: 'Claude Code', color: '#8B5CF6',
                    icon: <Cpu className="w-4 h-4 text-violet-400" />,
                    desc: 'Anthropic Pro subscription · Claude Code CLI',
                    install: 'npm install -g @anthropic-ai/claude-code',
                    login: 'claude login',
                  },
                  {
                    id: 'gemini-cli', label: 'Gemini CLI', color: '#3B82F6',
                    icon: <Globe className="w-4 h-4 text-blue-400" />,
                    desc: 'Google One AI Premium · Gemini CLI',
                    install: 'npm install -g @google/gemini-cli',
                    login: 'gemini auth login',
                  },
                  {
                    id: 'codex-cli', label: 'Codex CLI', color: '#10B981',
                    icon: <Zap className="w-4 h-4 text-emerald-400" />,
                    desc: 'ChatGPT Plus subscription · OpenAI Codex CLI',
                    install: 'npm install -g @openai/codex',
                    login: 'codex login',
                  },
                ]).map(p => (
                  <div key={p.id} className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/30 space-y-2">
                    <div className="flex items-center gap-3">
                      {p.icon}
                      <div className="flex-1">
                        <p className="text-sm font-medium text-zinc-200">{p.label}</p>
                        <p className="text-xs text-zinc-500">{p.desc}</p>
                      </div>
                      <Badge variant="warning" className="text-[9px] h-4">CLI Only</Badge>
                    </div>
                    <div className="flex items-start gap-2 rounded-lg bg-zinc-950/60 p-2.5 border border-zinc-800">
                      <Terminal className="w-3 h-3 text-zinc-600 mt-0.5 flex-shrink-0" />
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-zinc-600 font-mono">{p.install}</p>
                        <p className="text-[10px] text-zinc-600 font-mono">{p.login}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Routing options */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Routing Options</h4>
                {[
                  { key: 'routingEnabled',    label: 'Smart Routing',       desc: 'Auto-select the best provider for each task' },
                  { key: 'streamingEnabled',  label: 'Streaming Responses', desc: 'Show responses as they are generated' },
                  { key: 'memoryEnabled',     label: 'Project Memory',      desc: 'Include project context in conversations' },
                  { key: 'animationsEnabled', label: 'Animations',          desc: 'Enable smooth transitions and motion effects' },
                ].map(option => (
                  <div key={option.key} className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/30">
                    <div>
                      <p className="text-sm font-medium text-zinc-300">{option.label}</p>
                      <p className="text-xs text-zinc-600">{option.desc}</p>
                    </div>
                    <ToggleSwitch
                      value={settings[option.key as keyof typeof settings] as boolean}
                      onChange={v => updateSettings({ [option.key]: v })}
                    />
                  </div>
                ))}
              </div>

              <Button onClick={saveSettings} className="w-full">
                {saved ? <><Check className="w-4 h-4" /> Saved</> : 'Save Settings'}
              </Button>
            </motion.div>
          )}

          {/* ── API Keys ──────────────────────────────────────────────────── */}
          {activeSection === 'api-keys' && (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-zinc-200 mb-1">Optional API Providers</h3>
                <p className="text-xs text-zinc-500">
                  These create a separate metered bill. They are <strong className="text-zinc-400">NOT</strong> included in ChatGPT Plus, Claude Pro, or Google One subscriptions.
                </p>
              </div>

              {/* Billing warning */}
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                <div className="flex items-start gap-2.5">
                  <Shield className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-red-300 mb-1">Separate API billing — disabled by default</p>
                    <p className="text-xs text-red-400/70 leading-relaxed">
                      ChatGPT Plus does NOT include OpenAI API credits. Claude Pro does NOT include Anthropic API credits.
                      Google One AI Premium does NOT include Gemini API credits. Enabling these will charge your API account separately.
                    </p>
                  </div>
                </div>
              </div>

              {/* Enable API providers toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/30">
                <div>
                  <p className="text-sm font-medium text-zinc-300">Enable API Providers</p>
                  <p className="text-xs text-zinc-600">Allow claude-api, openai-api, gemini-api models</p>
                </div>
                <ToggleSwitch
                  value={settings.enableApiProviders ?? false}
                  onChange={v => updateSettings({ enableApiProviders: v })}
                />
              </div>

              {(settings.enableApiProviders ?? false) && (
                <>
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                    <div className="flex items-start gap-2.5">
                      <Key className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-amber-300 mb-1">Local Storage Only</p>
                        <p className="text-xs text-amber-400/70 leading-relaxed">
                          API keys are stored in your browser's local storage and are never sent to BertOS servers.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-5">
                    {[
                      { label: 'Anthropic API Key',  placeholder: 'sk-ant-...', value: anthropicKey, setter: setAnthropicKey, model: 'claude-api',  color: '#8B5CF6', icon: <Cpu className="w-4 h-4" />   },
                      { label: 'OpenAI API Key',      placeholder: 'sk-...',     value: openaiKey,    setter: setOpenaiKey,    model: 'openai-api',  color: '#10B981', icon: <Zap className="w-4 h-4" />   },
                      { label: 'Google AI API Key',   placeholder: 'AIza...',    value: googleKey,    setter: setGoogleKey,    model: 'gemini-api',  color: '#3B82F6', icon: <Globe className="w-4 h-4" /> },
                    ].map(field => (
                      <div key={field.label} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span style={{ color: field.color }}>{field.icon}</span>
                          <label className="text-sm font-medium text-zinc-300">{field.label}</label>
                          <Badge variant={field.value ? 'success' : 'default'} className="text-[9px] h-4 ml-auto">
                            {field.value ? 'Connected' : 'Not Set'}
                          </Badge>
                        </div>
                        <SecretInput value={field.value} onChange={field.setter} placeholder={field.placeholder} />
                        <p className="text-[11px] text-zinc-700">Used for {field.model} calls</p>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <Button onClick={saveSettings} className="w-full">
                {saved ? <><Check className="w-4 h-4" /> Saved Successfully</> : 'Save Settings'}
              </Button>
            </motion.div>
          )}

          {activeSection === 'appearance' && (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-zinc-200 mb-1">Appearance</h3>
                <p className="text-xs text-zinc-500">Customize the visual style of BertOS.</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'dark',     label: 'Dark',     preview: 'bg-zinc-900'    },
                  { value: 'darker',   label: 'Darker',   preview: 'bg-zinc-950'    },
                  { value: 'midnight', label: 'Midnight', preview: 'bg-[#05050A]'   },
                ].map(t => (
                  <button
                    key={t.value}
                    onClick={() => updateSettings({ theme: t.value as 'dark' | 'darker' | 'midnight' })}
                    className={cn(
                      'rounded-xl border p-4 text-center transition-all',
                      settings.theme === t.value
                        ? 'border-violet-500/40 bg-violet-500/10'
                        : 'border-zinc-800 hover:border-zinc-700'
                    )}
                  >
                    <div className={cn('w-full h-16 rounded-lg mb-2 border border-zinc-800', t.preview)} />
                    <p className="text-xs font-medium text-zinc-300">{t.label}</p>
                    {settings.theme === t.value && <Check className="w-3.5 h-3.5 text-violet-400 mx-auto mt-1" />}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {(activeSection === 'memory' || activeSection === 'performance' || activeSection === 'security') && (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-zinc-200 mb-1 capitalize">{activeSection.replace('-', ' ')}</h3>
                <p className="text-xs text-zinc-500">Advanced configuration options.</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-6 text-center">
                <Settings className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-sm text-zinc-600">Advanced settings coming soon</p>
                <p className="text-xs text-zinc-700 mt-1">These controls are being built into BertOS</p>
              </div>
            </motion.div>
          )}

          {/* ── Hermes Agent ──────────────────────────────────────────────── */}
          {activeSection === 'hermes' && (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-zinc-200 mb-1">Hermes Agent Integration</h3>
                <p className="text-xs text-zinc-500">
                  Connect to an always-running Hermes agent server for long-running tasks and memory.
                </p>
              </div>

              {/* URL input */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-violet-400" />
                  <p className="text-sm font-medium text-zinc-300">Server URL</p>
                </div>
                <input
                  type="url"
                  value={hermesUrl}
                  onChange={e => setHermesUrl(e.target.value)}
                  placeholder="https://your-hermes-server.com"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-700 outline-none focus:border-zinc-700 font-mono"
                />
              </div>

              {/* API key */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-violet-400" />
                  <p className="text-sm font-medium text-zinc-300">API Key</p>
                  <Badge variant={hermesApiKey ? 'success' : 'default'} className="text-[9px] h-4 ml-auto">
                    {hermesApiKey ? 'Set' : 'Not set'}
                  </Badge>
                </div>
                <SecretInput
                  value={hermesApiKey}
                  onChange={setHermesApiKey}
                  placeholder="hermes_..."
                />
              </div>

              {/* Test connection */}
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={testHermesConnection}
                  disabled={hermesLoading || !hermesUrl}
                  className="h-7 text-xs"
                >
                  {hermesLoading
                    ? <><RefreshCw className="w-3 h-3 animate-spin" /> Testing…</>
                    : <><Wifi className="w-3 h-3" /> Test Connection</>}
                </Button>
                {hermesStatus && (
                  <Badge variant={hermesStatus.online ? 'success' : 'error'} className="text-[9px] h-5">
                    {hermesStatus.online
                      ? `Connected${hermesStatus.version ? ` · v${hermesStatus.version}` : ''}`
                      : hermesStatus.error ?? 'Offline'}
                  </Badge>
                )}
              </div>

              {/* Status card */}
              {hermesStatus && (
                <div className={cn(
                  'rounded-xl border p-4',
                  hermesStatus.online
                    ? 'border-emerald-500/20 bg-emerald-500/5'
                    : 'border-red-500/20 bg-red-500/5'
                )}>
                  <div className="flex items-center gap-2">
                    {hermesStatus.online
                      ? <Wifi className="w-4 h-4 text-emerald-400" />
                      : <WifiOff className="w-4 h-4 text-red-400" />}
                    <p className={cn(
                      'text-sm font-medium',
                      hermesStatus.online ? 'text-emerald-300' : 'text-red-300'
                    )}>
                      {hermesStatus.online ? 'Hermes agent is reachable' : 'Could not reach Hermes server'}
                    </p>
                  </div>
                  {hermesStatus.error && (
                    <p className="text-xs text-red-400/70 mt-1.5 ml-6">{hermesStatus.error}</p>
                  )}
                </div>
              )}

              {/* Note */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-3">
                <p className="text-[11px] text-zinc-600 leading-relaxed">
                  Self-hosted only. See{' '}
                  <span className="text-zinc-500 font-mono">Hermes docs</span>{' '}
                  for setup instructions.
                </p>
              </div>

              <Button onClick={saveSettings} className="w-full">
                {saved ? <><Check className="w-4 h-4" /> Saved</> : 'Save Settings'}
              </Button>
            </motion.div>
          )}

          {/* ── Composio ──────────────────────────────────────────────────── */}
          {activeSection === 'composio' && (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-zinc-200 mb-1">Composio Tool Integration</h3>
                <p className="text-xs text-zinc-500">
                  Connect Composio to give BertOS access to external tools: GitHub, Slack, Notion, Gmail, Calendar, and more.
                </p>
              </div>

              {/* API key */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-blue-400" />
                  <p className="text-sm font-medium text-zinc-300">Composio API Key</p>
                  <Badge variant={composioKey ? 'success' : 'default'} className="text-[9px] h-4 ml-auto">
                    {composioKey ? 'Set' : 'Not set'}
                  </Badge>
                </div>
                <SecretInput
                  value={composioKey}
                  onChange={setComposioKey}
                  placeholder="comp_..."
                />
              </div>

              {/* Check status button */}
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={testComposioConnection}
                  disabled={composioLoading || !composioKey}
                  className="h-7 text-xs"
                >
                  {composioLoading
                    ? <><RefreshCw className="w-3 h-3 animate-spin" /> Checking…</>
                    : <><Globe className="w-3 h-3" /> Check Status</>}
                </Button>
                {composioStatus && (
                  <Badge
                    variant={composioStatus.connected ? 'success' : composioStatus.error?.includes('Invalid') ? 'error' : 'default'}
                    className="text-[9px] h-5"
                  >
                    {composioStatus.connected
                      ? 'Connected'
                      : composioStatus.error?.includes('Invalid')
                        ? 'Invalid Key'
                        : 'Not Connected'}
                  </Badge>
                )}
              </div>

              {/* Connected apps list */}
              {composioStatus?.connected && (composioStatus.apps?.length ?? 0) > 0 && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2">
                  <p className="text-xs font-semibold text-emerald-300">Connected Apps</p>
                  <div className="flex flex-wrap gap-1.5">
                    {composioStatus.apps!.map(app => (
                      <Badge key={app} variant="success" className="text-[10px]">{app}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Not connected: install instructions */}
              {composioStatus && !composioStatus.connected && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 space-y-2">
                  <p className="text-xs font-semibold text-zinc-400">Install Composio</p>
                  <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-3 space-y-1.5 font-mono text-[11px] text-zinc-500">
                    <p>pip install composio-core</p>
                    <p className="text-zinc-700">— or —</p>
                    <p>npm install composio-core</p>
                  </div>
                </div>
              )}

              {/* Billing note */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-3 flex items-start gap-2.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-zinc-600 leading-relaxed">
                  Composio has a free tier. Check{' '}
                  <span className="text-zinc-500 font-mono">composio.dev</span>{' '}
                  for pricing and available integrations.
                </p>
              </div>

              <Button onClick={saveSettings} className="w-full">
                {saved ? <><Check className="w-4 h-4" /> Saved</> : 'Save Settings'}
              </Button>
            </motion.div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
