'use client';
import { Bookmark, Flame, House, Layers, Plus, Sparkles, User, Wand2, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useFit } from '@/store/fit';
import { useSavedFits } from '@/store/saved-fits';

const tabs: Array<{ href: string; label: string; icon: typeof Flame }> = [
  { href: '/',         label: 'Home',    icon: House },
  { href: '/feed',     label: 'Feed',    icon: Flame },
  // Center slot is the create FAB — rendered separately so it can lift
  // above the nav bar visually.
  { href: '/saved',    label: 'Saved',   icon: Bookmark },
  { href: '/profile',  label: 'Profile', icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);

  // Snapshot real state for the action sheet — used to enable/disable
  // actions, never to display fake "yes you can do this" affordances.
  const currentFitItems = useFit((state) => state.items);
  const saveFit = useSavedFits((state) => state.saveFit);
  const savedCount = useSavedFits((state) => state.fits.length);
  const currentFitCount = Object.values(currentFitItems).filter(Boolean).length;

  function dispatch(action: string) {
    setCreateOpen(false);
    if (action === 'make-outfit') router.push('/build');
    else if (action === 'wardrobe') router.push('/wardrobe');
    else if (action === 'save-current') {
      if (currentFitCount === 0) return;
      saveFit(currentFitItems);
      router.push('/saved');
    } else if (action === 'feed') router.push('/feed');
    else if (action === 'stylist') router.push('/stylist');
    else if (action === 'canvas') router.push('/canvas');
  }

  return (
    <>
      <nav className="relative h-[68px] grid grid-cols-5 border-t border-hairline bg-bg pb-3.5 pt-1.5">
        {/* Left two tabs */}
        {tabs.slice(0, 2).map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center gap-1 text-[10px] font-medium ${
                active ? 'text-ink opacity-100' : 'text-muted opacity-55'
              }`}
            >
              {active ? <span className="absolute top-0.5 h-0.5 w-4 rounded bg-accent" /> : null}
              <Icon size={22} strokeWidth={1.6} />
              {label}
            </Link>
          );
        })}

        {/* Center create FAB — lifts above the nav line for emphasis */}
        <div className="relative flex items-start justify-center">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            aria-label="Create"
            className="absolute -top-7 grid h-14 w-14 place-items-center rounded-full border-[3px] border-bg bg-[linear-gradient(135deg,#f6306b_0%,#ff7099_55%,#f6306b_100%)] bg-[length:200%_100%] text-white shadow-[0_18px_36px_rgba(246,48,107,.55)] transition active:scale-90 hover:bg-right motion-safe:transition-all motion-safe:duration-200"
          >
            <Plus size={26} strokeWidth={2.4} />
          </button>
        </div>

        {/* Right two tabs */}
        {tabs.slice(2).map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center gap-1 text-[10px] font-medium ${
                active ? 'text-ink opacity-100' : 'text-muted opacity-55'
              }`}
            >
              {active ? <span className="absolute top-0.5 h-0.5 w-4 rounded bg-accent" /> : null}
              <Icon size={22} strokeWidth={1.6} />
              {label}
            </Link>
          );
        })}
      </nav>

      {createOpen ? (
        <div className="fixed inset-0 z-[60] mx-auto flex max-w-[480px] items-end bg-black/60 backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close create menu"
            onClick={() => setCreateOpen(false)}
          />
          <section className="relative z-10 w-full rounded-t-[30px] border border-white/12 bg-[#11100f] p-4 pb-[calc(env(safe-area-inset-bottom)+18px)] shadow-[0_-22px_60px_rgba(0,0,0,.6)]">
            <div className="mx-auto mb-3 h-1 w-11 rounded-full bg-white/20" />

            <div className="flex items-center justify-between">
              <div>
                <div className="text-[8px] font-black uppercase tracking-[.22em] text-accent">Create</div>
                <div className="mt-0.5 font-serif text-[22px] font-semibold text-ink">What do you want to do?</div>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                aria-label="Close"
                className="grid h-9 w-9 place-items-center rounded-full border border-white/12 bg-white/[0.04] text-white/80 transition active:scale-90 motion-safe:transition-transform motion-safe:duration-150 hover:bg-white/12"
              >
                <X size={15} />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <ActionCard
                eyebrow="Make"
                title="Make an outfit"
                body="Open Builder and generate."
                icon={Sparkles}
                onClick={() => dispatch('make-outfit')}
              />
              <ActionCard
                eyebrow="Closet"
                title="Add wardrobe item"
                body="Open closet to add pieces."
                icon={Layers}
                onClick={() => dispatch('wardrobe')}
              />
              <ActionCard
                eyebrow="Save"
                title="Save current fit"
                body={
                  currentFitCount > 0
                    ? `${currentFitCount} piece${currentFitCount === 1 ? '' : 's'} ready to save.`
                    : 'Build a fit first.'
                }
                icon={Bookmark}
                onClick={() => dispatch('save-current')}
                disabled={currentFitCount === 0}
              />
              <ActionCard
                eyebrow="Browse"
                title="Open feed"
                body="Catalog-backed fits to remix."
                icon={Flame}
                onClick={() => dispatch('feed')}
              />
              <ActionCard
                eyebrow="Local beta"
                title="AI Stylist chat"
                body="Ask Syli about your real fits."
                icon={Wand2}
                onClick={() => dispatch('stylist')}
              />
              <ActionCard
                eyebrow="Local shell"
                title="Canvas / Try On"
                body="Make a collage or share card."
                icon={Sparkles}
                onClick={() => dispatch('canvas')}
              />
            </div>

            <div className="mt-4 rounded-[16px] border border-white/8 bg-white/[0.03] px-3 py-2 text-[11px] leading-relaxed text-muted-2">
              Saved fits: <strong className="text-white">{savedCount}</strong> · Builder slots filled: <strong className="text-white">{currentFitCount}</strong>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function ActionCard({
  eyebrow,
  title,
  body,
  icon: Icon,
  onClick,
  disabled = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  icon: typeof Plus;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col gap-2 rounded-[20px] border-2 p-3 text-left transition active:scale-[0.97] motion-safe:transition-all motion-safe:duration-200 ${
        disabled
          ? 'cursor-not-allowed border-white/8 bg-white/[0.02] opacity-60'
          : 'border-white/12 bg-[linear-gradient(135deg,rgba(255,255,255,.08),rgba(255,255,255,.02))] hover:border-accent/55 hover:bg-[linear-gradient(135deg,rgba(246,48,107,.18),rgba(246,48,107,.04))]'
      }`}
    >
      <span
        className={`grid h-8 w-8 place-items-center rounded-full transition ${
          disabled ? 'bg-white/8 text-muted' : 'bg-accent/18 text-accent'
        }`}
      >
        <Icon size={14} />
      </span>
      <div className="text-[8px] font-black uppercase tracking-[.22em] text-accent">{eyebrow}</div>
      <div className="font-serif text-[14px] font-semibold leading-tight text-ink">{title}</div>
      <div className="text-[10px] leading-relaxed text-muted-2">{body}</div>
    </button>
  );
}
