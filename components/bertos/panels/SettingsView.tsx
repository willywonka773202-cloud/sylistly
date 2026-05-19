'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Settings, Key, Cpu, Globe, Zap, Sparkles, Monitor, Database,
  Shield, Sliders, Check, Eye, EyeOff, ChevronRight, Bot
} from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import { useUIStore } from '@/store/bertos/ui'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

const SECTIONS = [
  { id: 'models', icon: Sparkles, label: 'AI Models' },
  { id: 'api-keys', icon: Key, label: 'API Keys' },
  { id: 'appearance', icon: Monitor, label: 'Appearance' },
  { id: 'memory', icon: Database, label: 'Memory' },
  { id: 'performance', icon: Sliders, label: 'Performance' },
  { id: 'security', icon: Shield, label: 'Security' },
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
  const [activeSection, setActiveSection] = useState('models')
  const [saved, setSaved] = useState(false)
  const [anthropicKey, setAnthropicKey] = useState(settings.apiKeys.anthropic ?? '')
  const [openaiKey, setOpenaiKey] = useState(settings.apiKeys.openai ?? '')
  const [googleKey, setGoogleKey] = useState(settings.apiKeys.google ?? '')
  const [ollamaKey, setOllamaKey] = useState(settings.apiKeys.ollama ?? '')

  const saveSettings = () => {
    updateSettings({
      apiKeys: { anthropic: anthropicKey, openai: openaiKey, google: googleKey, ollama: ollamaKey }
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
          {activeSection === 'models' && (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-zinc-200 mb-1">AI Model Configuration</h3>
                <p className="text-xs text-zinc-500">Configure how BertOS selects and routes to AI models.</p>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Cloud Models</h4>
                {([
                  { value: 'auto',   label: 'Auto Router',      desc: 'Intelligently selects the best model for each task', icon: <Sparkles className="w-4 h-4 text-amber-400" />,  color: '#F59E0B' },
                  { value: 'claude', label: 'Claude (Anthropic)', desc: 'Best for reasoning, writing, and complex analysis', icon: <Cpu className="w-4 h-4 text-violet-400" />,      color: '#8B5CF6' },
                  { value: 'codex',  label: 'Codex (OpenAI)',    desc: 'Best for code generation and technical tasks',      icon: <Zap className="w-4 h-4 text-emerald-400" />,     color: '#10B981' },
                  { value: 'gemini', label: 'Gemini (Google)',   desc: 'Best for research and large context tasks',         icon: <Globe className="w-4 h-4 text-blue-400" />,      color: '#3B82F6' },
                ] as const).map(m => (
                  <button
                    key={m.value}
                    onClick={() => updateSettings({ primaryModel: m.value })}
                    className={cn(
                      'w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left',
                      settings.primaryModel === m.value
                        ? 'border-violet-500/30 bg-violet-500/5'
                        : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
                    )}
                  >
                    {m.icon}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-zinc-200">{m.label}</p>
                      <p className="text-xs text-zinc-500">{m.desc}</p>
                    </div>
                    {settings.primaryModel === m.value && (
                      <div className="w-5 h-5 rounded-full bg-violet-500/20 border border-violet-500/40 flex items-center justify-center">
                        <Check className="w-3 h-3 text-violet-400" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Open Source · Ollama Cloud</h4>
                {([
                  { value: 'llama3.2',       label: 'Llama 3.2',      desc: 'Meta · Fast general-purpose open-source model',       color: '#F97316' },
                  { value: 'mistral',        label: 'Mistral',         desc: 'Mistral AI · Excellent reasoning at low latency',      color: '#EC4899' },
                  { value: 'deepseek-coder', label: 'DeepSeek Coder',  desc: 'DeepSeek · Top-ranked open-source coding model',       color: '#06B6D4' },
                  { value: 'hermes3',        label: 'Hermes 3',         desc: 'NousResearch · Balanced open-source model via Ollama', color: '#A855F7' },
                ] as const).map(m => (
                  <button
                    key={m.value}
                    onClick={() => updateSettings({ primaryModel: m.value })}
                    className={cn(
                      'w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left',
                      settings.primaryModel === m.value
                        ? 'border-violet-500/30 bg-violet-500/5'
                        : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
                    )}
                  >
                    <Bot className="w-4 h-4 flex-shrink-0" style={{ color: m.color }} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-zinc-200">{m.label}</p>
                      <p className="text-xs text-zinc-500">{m.desc}</p>
                    </div>
                    {settings.primaryModel === m.value && (
                      <div className="w-5 h-5 rounded-full bg-violet-500/20 border border-violet-500/40 flex items-center justify-center">
                        <Check className="w-3 h-3 text-violet-400" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Routing Options</h4>
                {[
                  { key: 'routingEnabled', label: 'Smart Routing', desc: 'Automatically route prompts to the best model' },
                  { key: 'streamingEnabled', label: 'Streaming Responses', desc: 'Show responses as they are generated in real-time' },
                  { key: 'memoryEnabled', label: 'Project Memory', desc: 'Include project context in all conversations' },
                  { key: 'animationsEnabled', label: 'Animations', desc: 'Enable smooth transitions and motion effects' },
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
            </motion.div>
          )}

          {activeSection === 'api-keys' && (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-zinc-200 mb-1">API Keys</h3>
                <p className="text-xs text-zinc-500">
                  Configure API keys for direct API access. Keys are stored locally and never sent to any server.
                </p>
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="flex items-start gap-2.5">
                  <Shield className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-300 mb-1">Local Storage Only</p>
                    <p className="text-xs text-amber-400/70 leading-relaxed">
                      API keys are stored in your browser's local storage and are never transmitted to BertOS servers.
                      They are only sent directly to the respective AI provider APIs.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                {[
                  { label: 'Anthropic API Key',  placeholder: 'sk-ant-...', value: anthropicKey, setter: setAnthropicKey, model: 'Claude',              color: '#8B5CF6', icon: <Cpu className="w-4 h-4" />  },
                  { label: 'OpenAI API Key',      placeholder: 'sk-...',     value: openaiKey,    setter: setOpenaiKey,    model: 'Codex / GPT-4o',       color: '#10B981', icon: <Zap className="w-4 h-4" />  },
                  { label: 'Google AI API Key',   placeholder: 'AIza...',    value: googleKey,    setter: setGoogleKey,    model: 'Gemini',                color: '#3B82F6', icon: <Globe className="w-4 h-4" /> },
                  { label: 'Ollama Cloud API Key', placeholder: 'ollama_...',value: ollamaKey,    setter: setOllamaKey,    model: 'Llama · Mistral · DeepSeek', color: '#F97316', icon: <Bot className="w-4 h-4" />  },
                ].map(field => (
                  <div key={field.label} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span style={{ color: field.color }}>{field.icon}</span>
                      <label className="text-sm font-medium text-zinc-300">{field.label}</label>
                      <Badge
                        variant={field.value ? 'success' : 'default'}
                        className="text-[9px] h-4 ml-auto"
                      >
                        {field.value ? 'Connected' : 'Not Set'}
                      </Badge>
                    </div>
                    <SecretInput
                      value={field.value}
                      onChange={field.setter}
                      placeholder={field.placeholder}
                    />
                    <p className="text-[11px] text-zinc-700">Used for {field.model} API calls</p>
                  </div>
                ))}
              </div>

              <Button onClick={saveSettings} className="w-full">
                {saved ? (
                  <><Check className="w-4 h-4" /> Saved Successfully</>
                ) : (
                  'Save API Keys'
                )}
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
                  { value: 'dark', label: 'Dark', preview: 'bg-zinc-900' },
                  { value: 'darker', label: 'Darker', preview: 'bg-zinc-950' },
                  { value: 'midnight', label: 'Midnight', preview: 'bg-[#05050A]' },
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
