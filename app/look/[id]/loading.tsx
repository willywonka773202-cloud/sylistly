export default function LookLoading() {
  return (
    <main className="mx-auto min-h-[100dvh] max-w-[480px] bg-bg px-4 pt-[calc(env(safe-area-inset-top)+18px)]">
      <div className="h-6 w-32 animate-pulse rounded-full bg-surface-2" />
      <div className="mt-4 aspect-[3/4] animate-pulse rounded-card-lg bg-surface-1" />
      <div className="mt-5 h-9 w-52 animate-pulse rounded-full bg-surface-2" />
      <div className="mt-4 grid gap-2">
        {[0, 1, 2].map((index) => (
          <div key={index} className="h-[64px] animate-pulse rounded-card bg-surface-1" />
        ))}
      </div>
    </main>
  );
}
