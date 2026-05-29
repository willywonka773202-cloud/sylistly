'use client';
import type { ReactNode, ButtonHTMLAttributes } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

/* ============ PremiumButton ============ */
type BtnVariant = 'primary' | 'secondary' | 'accent' | 'ghost';
type BtnSize = 'sm' | 'md' | 'lg';

const BTN_VARIANT: Record<BtnVariant, string> = {
  primary: 'bg-ink text-cream',
  secondary: 'bg-surface-1 text-ink border border-hairline-2',
  accent: 'bg-accent text-white',
  ghost: 'bg-transparent text-ink',
};
const BTN_SIZE: Record<BtnSize, string> = {
  sm: 'h-9 px-4 text-[13px] rounded-full',
  md: 'h-12 px-5 text-sm rounded-full',
  lg: 'h-14 px-6 text-[15px] rounded-2xl',
};

export function PremiumButton({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth,
  icon,
  iconRight,
  className = '',
  ...props
}: {
  children: ReactNode;
  variant?: BtnVariant;
  size?: BtnSize;
  fullWidth?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      className={`inline-flex items-center justify-center gap-2 font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none ${BTN_VARIANT[variant]} ${BTN_SIZE[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...(props as React.ComponentProps<typeof motion.button>)}
    >
      {icon}
      {children}
      {iconRight}
    </motion.button>
  );
}

/* ============ IconButton ============ */
export function IconButton({
  children,
  active,
  className = '',
  ...props
}: { children: ReactNode; active?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      className={`grid place-items-center w-10 h-10 rounded-full border transition-colors ${
        active ? 'bg-ink text-cream border-ink' : 'bg-surface-1 text-ink border-hairline-2'
      } ${className}`}
      {...(props as React.ComponentProps<typeof motion.button>)}
    >
      {children}
    </motion.button>
  );
}

/* ============ Pill / CategoryPills ============ */
export function Pill({
  children,
  active,
  onClick,
  className = '',
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3.5 h-9 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors btn-press ${
        active
          ? 'bg-ink text-cream'
          : 'bg-surface-1 text-muted-2 border border-hairline hover:border-hairline-2'
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function CategoryPills<T extends string>({
  options,
  active,
  onChange,
  className = '',
}: {
  options: Array<{ value: T; label: string }>;
  active: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={`flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5 ${className}`}>
      {options.map((o) => (
        <Pill key={o.value} active={active === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </Pill>
      ))}
    </div>
  );
}

/* ============ SegmentedControl ============ */
export function SegmentedControl<T extends string>({
  options,
  active,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  active: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="relative flex p-1 rounded-full bg-surface-2 border border-hairline">
      {options.map((o) => {
        const isActive = active === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className="relative flex-1 h-9 text-[13px] font-semibold rounded-full"
          >
            {isActive && (
              <motion.div
                layoutId="seg-active"
                className="absolute inset-0 rounded-full bg-surface-1 shadow-soft"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.45 }}
              />
            )}
            <span className={`relative z-10 ${isActive ? 'text-ink' : 'text-muted'}`}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ============ Chip ============ */
export function Chip({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'ink' | 'accent' }) {
  const tones = {
    default: 'bg-surface-2 text-muted-2',
    ink: 'bg-ink text-cream',
    accent: 'bg-accent-soft text-accent',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 h-7 rounded-full text-[11px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

/* ============ SectionHeader ============ */
export function SectionHeader({
  title,
  kicker,
  action,
  onAction,
}: {
  title: string;
  kicker?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-end justify-between mb-3">
      <div>
        {kicker && <div className="text-2xs uppercase tracking-editorial text-muted mb-1">{kicker}</div>}
        <h2 className="font-display text-xl text-ink">{title}</h2>
      </div>
      {action && (
        <button onClick={onAction} className="flex items-center gap-0.5 text-[13px] text-muted-2 font-medium btn-press">
          {action}
          <ChevronRight size={15} />
        </button>
      )}
    </div>
  );
}

/* ============ Avatar ============ */
export function Avatar({
  name,
  color,
  size = 40,
  ring,
  className = '',
}: {
  name: string;
  color: string;
  size?: number;
  ring?: 'unviewed' | 'viewed' | 'none';
  className?: string;
}) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const inner = (
    <div
      className={`grid place-items-center rounded-full text-cream font-semibold ${className}`}
      style={{ width: size, height: size, background: color, fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  );
  if (!ring || ring === 'none') return inner;
  return (
    <div className={ring === 'unviewed' ? 'story-ring rounded-full p-[2px]' : 'story-ring-viewed rounded-full p-[2px]'}>
      <div className="rounded-full p-[2px] bg-bg">{inner}</div>
    </div>
  );
}

/* ============ EmptyState ============ */
export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center py-14 px-6">
      <div className="grid place-items-center w-16 h-16 rounded-3xl bg-surface-2 text-ink-soft mb-4">{icon}</div>
      <h3 className="font-display text-xl text-ink">{title}</h3>
      {subtitle && <p className="text-sm text-muted mt-1.5 max-w-[260px] text-balance">{subtitle}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
