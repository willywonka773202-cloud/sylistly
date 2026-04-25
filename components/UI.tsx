'use client';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { X, Circle, ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface AccordionItem {
  id: string;
  title: string;
  content: ReactNode;
}

interface AccordionProps {
  items: AccordionItem[];
  allowMultiple?: boolean;
  defaultOpen?: string[];
}

export function Accordion({ items, allowMultiple = false, defaultOpen = [] }: AccordionProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set(defaultOpen));

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (!allowMultiple) {
        next.clear();
        next.add(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const isOpen = openIds.has(item.id);
        return (
          <motion.div
            key={item.id}
            className="rounded-xl border border-hairline bg-surface-2 overflow-hidden"
          >
            <button
              onClick={() => toggle(item.id)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <span className="font-medium">{item.title}</span>
              <ChevronDown
                size={18}
                className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            </button>
            <motion.div
              initial={false}
              animate={{ 
                height: isOpen ? 'auto' : 0,
                opacity: isOpen ? 1 : 0,
              }}
              className="overflow-hidden"
            >
              <div className="p-4 pt-0 text-sm text-muted">
                {item.content}
              </div>
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}

export function StepIndicator({ 
  steps, 
  current,
  onChange,
}: { 
  steps: { id: string; label: string }[];
  current: number;
  onChange?: (index: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {steps.map((step, index) => (
        <button
          key={step.id}
          onClick={() => onChange?.(index)}
          className={`flex-1 h-1.5 rounded-full transition-colors ${
            index === current 
              ? 'bg-accent' 
              : index < current 
                ? 'bg-accent/50' 
                : 'bg-surface-3'
          }`}
        />
      ))}
    </div>
  );
}

export function ProgressBar({ 
  value = 0, 
  max = 100,
  label,
  showValue = false,
}: { 
  value?: number;
  max?: number;
  label?: string;
  showValue?: boolean;
}) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  
  return (
    <div className="space-y-1">
      {(label || showValue) && (
        <div className="flex items-center justify-between text-xs">
          {label && <span className="text-muted">{label}</span>}
          {showValue && <span className="text-muted">{Math.round(percent)}%</span>}
        </div>
      )}
      <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
        <motion.div
          initial={false}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="h-full bg-accent rounded-full"
        />
      </div>
    </div>
  );
}

export function Badge({ 
  children, 
  variant = 'default',
  size = 'sm',
}: { 
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md';
}) {
  const styles = {
    default: 'bg-surface-2 text-muted',
    success: 'bg-emerald/20 text-emerald',
    warning: 'bg-amber-500/20 text-amber-500',
    error: 'bg-red-500/20 text-red-500',
  };
  
  const sizes = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-3 py-1 text-xs',
  };
  
  return (
    <span className={`rounded-full font-medium ${styles[variant]} ${sizes[size]}`}>
      {children}
    </span>
  );
}

export function Tabs({ 
  tabs, 
  active,
  onChange,
}: { 
  tabs: { id: string; label: string; icon?: ReactNode }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-1 p-1 rounded-xl bg-surface-1 border border-hairline">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
            active === tab.id 
              ? 'bg-surface-2 text-ink' 
              : 'text-muted hover:text-ink'
          }`}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}