'use client';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Wand2, Check, Sparkles } from 'lucide-react';
import { AppShell, AppHeader } from '@/components/AppShell';
import { OutfitCanvas } from '@/components/editor/OutfitCanvas';
import { EditorToolbar } from '@/components/editor/EditorToolbar';
import { ItemPicker } from '@/components/editor/ItemPicker';
import { SaveOutfitSheet, type SaveOutfitMeta } from '@/components/SaveOutfitSheet';
import { PremiumButton } from '@/components/Primitives';
import { successToast } from '@/components/Toast';
import type { AestheticId, ClosetItem, LayoutPreset, Outfit, OutfitLayoutItem } from '@/lib/social-types';
import { autoArrange } from '@/lib/outfit-layout';
import { resolveItem } from '@/lib/item-registry';
import { buildOutfitFromCloset } from '@/lib/stylist';
import { useMyClosetItems } from '@/store/closet';
import { useOutfits, useResolveOutfit } from '@/store/outfits';
import { usePlanner } from '@/store/planner';

const clamp = (n: number) => Math.max(0.06, Math.min(0.94, n));
const newKey = () => `inst-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const uid = (l: OutfitLayoutItem) => l.key ?? l.itemId;

function deriveAesthetics(itemIds: string[]): AestheticId[] {
  const counts: Record<string, number> = {};
  for (const id of itemIds) {
    const item = resolveItem(id);
    item?.tags.forEach((t) => (counts[t] = (counts[t] || 0) + 1));
  }
  return (Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k)) as AestheticId[];
}

function CreateEditor() {
  const router = useRouter();
  const params = useSearchParams();
  const myItems = useMyClosetItems();
  const saveOutfit = useOutfits((s) => s.saveOutfit);
  const resolveOutfit = useResolveOutfit();
  const schedule = usePlanner((s) => s.schedule);

  const [layout, setLayout] = useState<OutfitLayoutItem[]>([]);
  const [background, setBackground] = useState('paper');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [initialMeta, setInitialMeta] = useState<Partial<SaveOutfitMeta>>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const loaded = useRef(false);

  // load remix / edit source once
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    const editId = params.get('edit');
    const remixId = params.get('remix');
    const src = editId || remixId ? resolveOutfit((editId || remixId)!) : null;
    if (src) {
      setLayout(src.layout.map((l) => ({ ...l })));
      setBackground(src.background);
      if (editId) {
        const isUser = useOutfits.getState().userOutfits.some((o) => o.id === editId);
        if (isUser) {
          setDraftId(editId);
          setInitialMeta({
            title: src.title,
            caption: src.caption,
            occasion: src.occasion,
            visibility: src.visibility,
            storyEnabled: src.storyEnabled,
            scheduledDate: src.scheduledDate,
          });
        } else {
          setInitialMeta({ title: `${src.title} (remix)`, occasion: src.occasion });
        }
      } else {
        setInitialMeta({ title: `${src.title} (remix)`, occasion: src.occasion });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inCanvas = useMemo(() => layout.map((l) => l.itemId), [layout]);
  const maxZ = layout.reduce((m, l) => Math.max(m, l.z), 0);
  const minZ = layout.reduce((m, l) => Math.min(m, l.z), 0);

  function addItem(item: ClosetItem) {
    const key = newKey();
    setLayout((prev) => [
      ...prev,
      { itemId: item.id, key, x: 0.5, y: 0.42, scale: 1, rotation: 0, z: maxZ + 1 },
    ]);
    setSelectedId(key);
  }

  function duplicate(id: string) {
    const src = layout.find((l) => uid(l) === id);
    if (!src) return;
    const key = newKey();
    setLayout((prev) => [...prev, { ...src, key, x: clamp(src.x + 0.07), y: clamp(src.y + 0.07), z: maxZ + 1 }]);
    setSelectedId(key);
  }

  function remove(id: string) {
    setLayout((prev) => prev.filter((l) => uid(l) !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function flip() {
    if (!selectedId) return;
    setLayout((prev) => prev.map((l) => (uid(l) === selectedId ? { ...l, flip: !l.flip } : l)));
  }

  function layer(dir: 'up' | 'down') {
    if (!selectedId) return;
    setLayout((prev) => prev.map((l) => (uid(l) === selectedId ? { ...l, z: dir === 'up' ? maxZ + 1 : minZ - 1 } : l)));
  }

  function applyPreset(preset: LayoutPreset) {
    const pairs = layout.map((l) => ({ l, item: resolveItem(l.itemId) })).filter((x) => x.item);
    const arranged = autoArrange(pairs.map((p) => ({ itemId: p.l.itemId, category: p.item!.category })), preset);
    setLayout(arranged.map((a, i) => ({ ...a, key: pairs[i].l.key })));
  }

  function surprise() {
    const draft = buildOutfitFromCloset(myItems, { seed: Date.now() % 7 });
    if (!draft) {
      successToast('Add a few items to your closet first');
      return;
    }
    setLayout(draft.layout.map((l) => ({ ...l, key: newKey() })));
    setBackground(draft.background);
    setSelectedId(null);
    successToast('Styled from your closet ✨');
  }

  function handleSave(meta: SaveOutfitMeta) {
    const itemIds = [...new Set(layout.map((l) => l.itemId))];
    const id = draftId ?? `user-outfit-${Date.now()}`;
    const outfit: Outfit = {
      id,
      title: meta.title,
      caption: meta.caption,
      itemIds,
      layout,
      background,
      preset: 'editorial',
      occasion: meta.occasion,
      aesthetics: deriveAesthetics(itemIds),
      visibility: meta.visibility,
      ownerId: 'me',
      scheduledDate: meta.scheduledDate,
      storyEnabled: meta.storyEnabled,
      createdAt: new Date().toISOString(),
      likes: 0,
      saves: 0,
      source: 'user',
    };
    saveOutfit(outfit);
    if (meta.scheduledDate) schedule(meta.scheduledDate, id, meta.occasion);
    setSaveOpen(false);
    successToast(meta.storyEnabled ? 'Saved & posted to your story' : 'Outfit saved');
    router.push('/profile');
  }

  return (
    <AppShell
      showTabBar={false}
      pad={false}
      header={
        <AppHeader
          title={draftId ? 'Edit outfit' : 'Create'}
          kicker="Outfit studio"
          back
          onBack={() => router.push('/')}
          right={
            <button
              onClick={surprise}
              className="flex items-center gap-1.5 px-3 h-9 rounded-full bg-surface-1 border border-hairline text-ink text-[13px] font-semibold btn-press"
            >
              <Sparkles size={15} /> Surprise
            </button>
          }
        />
      }
    >
      <div className="px-5 pt-3 pb-44">
        <OutfitCanvas
          layout={layout}
          background={background}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onChange={setLayout}
          onDelete={remove}
          onDuplicate={duplicate}
          className="w-full aspect-[4/5] rounded-[28px] border border-hairline shadow-card"
        />
        <p className="text-center text-[11px] text-muted mt-2">
          Drag to move · corner to resize · top handle to rotate
        </p>

        <div className="mt-4">
          <EditorToolbar
            background={background}
            onBackground={setBackground}
            onAutoArrange={applyPreset}
            selectedId={selectedId}
            onFlip={flip}
            onLayer={layer}
          />
        </div>
      </div>

      {/* bottom action bar */}
      <div className="fixed bottom-0 inset-x-0 z-30">
        <div className="mx-auto max-w-[440px] px-5 pb-[max(14px,env(safe-area-inset-bottom))] pt-3 glass border-t border-hairline">
          <div className="flex gap-2">
            <PremiumButton variant="secondary" size="lg" className="flex-1" onClick={() => setPickerOpen(true)} icon={<Plus size={18} />}>
              Add piece
            </PremiumButton>
            <PremiumButton size="lg" className="flex-1" onClick={() => setSaveOpen(true)} icon={<Check size={18} />} disabled={layout.length === 0}>
              Save
            </PremiumButton>
          </div>
        </div>
      </div>

      <ItemPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={addItem} inCanvas={inCanvas} />
      <SaveOutfitSheet
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        draft={{ layout, background, itemIds: inCanvas }}
        initial={initialMeta}
        onSave={handleSave}
      />
    </AppShell>
  );
}

export default function CreatePage() {
  return (
    <Suspense
      fallback={
        <AppShell showTabBar={false} pad={false} header={<AppHeader title="Create" back />}>
          <div className="grid place-items-center h-[60vh] text-muted">
            <Wand2 className="animate-pulse" />
          </div>
        </AppShell>
      }
    >
      <CreateEditor />
    </Suspense>
  );
}
