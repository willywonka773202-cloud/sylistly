export default function BrowseLoading() {
  return (
    <main className="mx-auto min-h-[100dvh] max-w-[480px] bg-bg px-4 pt-[calc(env(safe-area-inset-top)+14px)]">
      <div className="h-9 w-44 animate-pulse rounded-full bg-surface-2" />
      <div className="mt-4 flex gap-2">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="h-9 w-20 animate-pulse rounded-full bg-surface-1" />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <div key={index} className="h-[210px] animate-pulse rounded-card bg-surface-1" />
        ))}
      </div>
    </main>
  );
}
