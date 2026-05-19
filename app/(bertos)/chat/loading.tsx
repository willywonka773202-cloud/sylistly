export default function ChatLoading() {
  return (
    <div className="flex flex-col h-full items-center justify-center">
      <div className="space-y-3 w-full max-w-3xl px-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-7 h-7 rounded-lg bg-zinc-800 flex-shrink-0" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-2.5 bg-zinc-800 rounded-full w-16" />
              <div className="h-2.5 bg-zinc-800/60 rounded-full w-full" />
              <div className="h-2.5 bg-zinc-800/40 rounded-full w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
