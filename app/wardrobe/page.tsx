"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collegeWardrobe, wardrobeSummary, type WardrobeItem } from "@/data/college-wardrobe";
import BottomNav from "@/components/BottomNav";

const STORAGE_KEY = "sylistly.college-wardrobe.owned.v1";

export default function WardrobePage() {
  const [owned, setOwned] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setOwned(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(owned));
    } catch {}
  }, [owned]);

  const toggleOwned = (id: string) => {
    setOwned((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const grouped = useMemo(() => {
    const map = new Map<string, WardrobeItem[]>();
    for (const item of collegeWardrobe) {
      const list = map.get(item.category) || [];
      list.push(item);
      map.set(item.category, list);
    }
    return Array.from(map.entries());
  }, []);

  const ownedCount = Object.values(owned).filter(Boolean).length;
  const totalItems = collegeWardrobe.length;

  return (
    <div className="min-h-screen bg-neutral-950 text-white pb-24">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-neutral-950/90 backdrop-blur px-4 py-4">
        <div className="max-w-lg mx-auto">
          <Link href="/" className="text-xs text-white/50 hover:text-white">
            ← Back to Builder
          </Link>
          <h1 className="mt-2 text-xl font-semibold tracking-tight">{wardrobeSummary.title}</h1>
          <p className="text-sm text-white/60 mt-1">{wardrobeSummary.subtitle}</p>
          <p className="text-xs text-emerald-400/90 mt-2">
            {ownedCount}/{totalItems} marked owned · Est. {wardrobeSummary.estimatedTotal}
          </p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-8">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
          <h2 className="text-sm font-medium text-white/80">Notes for Will</h2>
          <ul className="text-sm text-white/60 space-y-1 list-disc list-inside">
            {wardrobeSummary.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>

        {grouped.map(([category, items]) => (
          <section key={category}>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/40 mb-3">
              {category}
            </h2>
            <div className="space-y-3">
              {items.map((item) => {
                const isOwned = !!owned[item.id];
                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-4 transition ${
                      isOwned
                        ? "border-emerald-500/40 bg-emerald-500/10"
                        : "border-white/10 bg-white/5"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-sm leading-snug">{item.item}</h3>
                          {isOwned && (
                            <span className="text-[10px] uppercase tracking-wide text-emerald-400 font-medium">
                              Owned
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-white/50 mt-1">
                          Qty {item.qty} · {item.priceEach} each · ~{item.total}
                        </p>
                        <p className="text-xs text-white/40 mt-2">{item.notes}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleOwned(item.id)}
                        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ${
                          isOwned
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-white/10 text-white/80 hover:bg-white/15"
                        }`}
                      >
                        {isOwned ? "Owned" : "Mark owned"}
                      </button>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center rounded-lg bg-white text-black text-xs font-medium px-3 py-1.5 hover:bg-white/90"
                      >
                        Shop / View
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        <p className="text-center text-xs text-white/30 pt-4">
          Personalized for Will · SDSU gym-bro starter · Data from July 2026 wardrobe plan
        </p>
      </main>

      <BottomNav />
    </div>
  );
}
