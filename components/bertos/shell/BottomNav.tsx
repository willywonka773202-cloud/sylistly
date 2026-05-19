'use client'
import { MessageSquare, GitCompare, Code2, Bot, Settings } from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import { useUIStore } from '@/store/bertos/ui'
import { useRouter } from 'next/navigation'

const ITEMS = [
  { id: 'chat',      icon: MessageSquare, label: 'Chat',     href: '/chat'      },
  { id: 'compare',   icon: GitCompare,    label: 'Compare',  href: '/compare'   },
  { id: 'workspace', icon: Code2,         label: 'Code',     href: '/workspace' },
  { id: 'agents',    icon: Bot,           label: 'Agents',   href: '/agents'    },
  { id: 'settings',  icon: Settings,      label: 'Settings', href: '/settings'  },
] as const

export function BottomNav() {
  const { activeView, setActiveView } = useUIStore()
  const router = useRouter()

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-[#0D0D0F]/95 backdrop-blur-sm border-t border-zinc-800/60 pb-safe">
      <div className="flex items-center justify-around px-1 pt-1.5 pb-1.5">
        {ITEMS.map(item => {
          const isActive = activeView === item.id
          return (
            <button
              key={item.id}
              onClick={() => { setActiveView(item.id); router.push(item.href) }}
              className={cn(
                'flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-xl transition-all active:scale-95',
                isActive ? 'text-violet-400' : 'text-zinc-600',
              )}
            >
              <item.icon className={cn('w-5 h-5', isActive && 'text-violet-400')} style={isActive ? { filter: 'drop-shadow(0 0 6px rgba(139,92,246,0.5))' } : undefined} />
              <span className={cn('text-[9px] font-semibold tracking-wide', isActive ? 'text-violet-400' : 'text-zinc-700')}>
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
