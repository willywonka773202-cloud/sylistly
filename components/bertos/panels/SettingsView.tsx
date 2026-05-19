'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Settings, Key, Globe, Zap, Sparkles, Monitor, Database,
  Shield, Sliders, Check, Eye, EyeOff, Bot, Server, Cpu, Terminal
} from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import { useUIStore } from '@/store/bertos/ui'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

const SECTIONS = [
  { id: 'providers', icon: Bot,      label: 'Providers'   },
  { id: 'api-keys',  icon: Key,      label: 'API Keys'    },
  { id: 'appearance',icon: Monitor,  label: 'Appearance'  },
  { id: 'memory',    icon: Database, label: 'Memory'      },
  { id: 'performance',icon: Sliders, label: 'Performance' },
  { id: 'security',  icon: Shield,   label: 'Security'    },
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

export function SettingsView() {
  const { settings, updateSettings } = useUIStore()
  const [activeSection, setActiveSection] = useState('providers')
  const [saved, setSaved] = useState(false)
  const [anthropicKey, setAnthropicKey] = useState(settings.apiKeys.anthropic ?? '')
  const [openaiKey, setOpenaiKey] = useState(settings.apiKeys.openai ?? '')
  const [googleKey, setGoogleKey] = useState(settings.apiKeys.google ?? '')
  const [ollamaEndpoint, setOllamaEndpoint] = useState(settings.ollamaEndpoint ?? '')

  const saveSettings = () => {
    updateSettings({
      apiKeys: { anthropic: anthropicKey, openai: openaiKey, google: googleKey },
      ollamaEndpoint: ollamaEndpoint.trim() || undefined,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
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
                <div className="flex items-center gap-3 p-3.5 rounded-xl border border-orange-500/20 bg-orange-500/5">
                  <Bot className="w-4 h-4 text-orange-400 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-zinc-200">Ollama Pro</p>
                    <p className="text-xs text-zinc-500">gpt-oss:120b-cloud · No API billing · Works at localhost:11434 by default</p>
                  </div>
                  <Badge variant="success" className="text-[9px] h-4">Active</Badge>
                </div>

                {/* Ollama endpoint config */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-orange-400" />
                    <p className="text-sm font-medium text-zinc-300">Ollama Endpoint</p>
                    <Badge variant={ollamaEndpoint ? 'success' : 'default'} className="text-[9px] h-4 ml-auto">
                      {ollamaEndpoint ? 'Custom' : 'localhost:11434'}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-zinc-600 leading-relaxed">
                    Override the default local Ollama URL. Leave blank to use <code className="text-zinc-500">http://127.0.0.1:11434</code>.
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
                      Clear — revert to localhost:11434
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
        </div>
      </ScrollArea>
    </div>
  )
}
