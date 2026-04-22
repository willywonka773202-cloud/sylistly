import { Bookmark, Cloud, Database } from 'lucide-react';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';

export default function SavedPage() {
  return (
    <PlaceholderScreen
      eyebrow="Saved"
      title="Fits"
      accent="saved"
      description="The route works now. Saving is still waiting on the full Supabase wiring, so this screen sets expectations instead of failing silently."
    >
      <section className="rounded-3xl border border-hairline bg-surface-1 p-5">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent/10 text-accent">
          <Bookmark size={18} />
        </div>
        <h2 className="mt-4 font-serif text-[20px] font-semibold text-ink">Saved looks are almost ready</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-2">
          Search, build, and shop are the live focus right now. Persistent saved fits will unlock once the database and auth env vars are fully connected.
        </p>

        <div className="mt-5 grid gap-3">
          <div className="rounded-2xl border border-hairline bg-surface-2 p-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[.18em] text-muted">
              <Cloud size={14} />
              Missing piece
            </div>
            <div className="mt-2 text-[13px] text-ink">Supabase auth and storage need to be live for real saved fits.</div>
          </div>

          <div className="rounded-2xl border border-hairline bg-surface-2 p-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[.18em] text-muted">
              <Database size={14} />
              Right now
            </div>
            <div className="mt-2 text-[13px] text-ink">Use the builder to test search quality and product selection without dropping into a broken page.</div>
          </div>
        </div>
      </section>
    </PlaceholderScreen>
  );
}
