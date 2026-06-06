"use client"

import { useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { api } from "@/trpc/react"
import { TunnelCard } from "@/components/tunnel-card"
import { TunnelsEmpty } from "@/components/tunnels-empty"
import { TunnelsSkeleton } from "@/components/tunnels-skeleton"

export default function DashboardPage() {
  const utils = api.useUtils()
  const {
    data: tunnels,
    isLoading,
    error,
  } = api.tunnels.list.useQuery(undefined, {
    refetchInterval: (query) =>
      query.state.data?.some((t) => t.status === "running") ? 10_000 : false,
  })
  const reconcile = useRef(api.tunnels.reconcile.useMutation())

  useEffect(() => {
    reconcile.current.mutate()
  }, [])

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      {error && (
        <div className="rounded-none border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          <p>{error.message}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => utils.tunnels.list.refetch()}
            className="mt-2"
          >
            Retry
          </Button>
        </div>
      )}

      {isLoading ? (
        <TunnelsSkeleton />
      ) : !tunnels || tunnels.length === 0 ? (
        <TunnelsEmpty />
      ) : (
        <div className="flex flex-col gap-4">
          {tunnels.map((tunnel) => (
            <TunnelCard key={tunnel.id} tunnel={tunnel} />
          ))}
        </div>
      )}
    </div>
  )
}
