/**
 * NavigationSkeleton - Ultra-lightweight placeholder during node navigation
 *
 * This component has:
 * - NO store subscriptions (no re-renders from state changes)
 * - NO useEffect hooks (no side effects)
 * - Pure CSS animations only
 *
 * It renders instantly (<16ms) while data loads in the background.
 */
export function NavigationSkeleton() {
  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* Message area skeleton */}
      <div className="flex-1 p-4 space-y-4 overflow-hidden">
        {/* Simulated message bubbles */}
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-white/5 animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-white/5 rounded w-24 animate-pulse" />
            <div className="h-16 bg-white/5 rounded-lg w-3/4 animate-pulse" />
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <div className="flex-1 space-y-2 flex flex-col items-end">
            <div className="h-4 bg-white/5 rounded w-16 animate-pulse" />
            <div className="h-12 bg-white/5 rounded-lg w-1/2 animate-pulse" />
          </div>
        </div>

        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-white/5 animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-white/5 rounded w-20 animate-pulse" />
            <div className="h-24 bg-white/5 rounded-lg w-2/3 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Input area skeleton */}
      <div className="border-t border-white/10 p-4">
        <div className="h-12 bg-white/5 rounded-lg animate-pulse" />
      </div>
    </div>
  );
}
