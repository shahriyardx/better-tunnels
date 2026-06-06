export function TunnelsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-none border bg-card p-5 space-y-4 animate-pulse">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="h-4 w-28 bg-muted" />
              <div className="h-3 w-36 bg-muted" />
            </div>
            <div className="h-3 w-12 bg-muted" />
          </div>
          <div className="h-3 w-24 bg-muted" />
          <div className="flex gap-2">
            <div className="h-8 w-16 bg-muted" />
            <div className="h-8 w-16 bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
