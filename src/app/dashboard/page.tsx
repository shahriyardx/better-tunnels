"use client"

import {
  GlobeIcon,
  CloudIcon,
  TerminalIcon,
  FingerprintIcon,
} from "@phosphor-icons/react"
import { api } from "@/trpc/react"

export default function OverviewPage() {
  const { data: domainData, isLoading: domainLoading } =
    api.domains.list.useQuery()
  const { data: tunnels, isLoading: tunnelsLoading } =
    api.tunnels.list.useQuery()
  const { data: userData, isLoading: userLoading } = api.user.info.useQuery()

  if (domainLoading || tunnelsLoading || userLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">Loading overview...</p>
      </div>
    )
  }

  const zones = domainData?.zones ?? []
  const stats = {
    total: tunnels?.length ?? 0,
    running: tunnels?.filter((t) => t.status === "running").length ?? 0,
  }
  const account = userData?.accountID ? userData : null

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 max-w-xl">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border bg-card p-5">
          <div className="flex items-center gap-3">
            <TerminalIcon className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-mono">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Tunnels</p>
            </div>
          </div>
        </div>
        <div className="border bg-card p-5">
          <div className="flex items-center gap-3">
            <CloudIcon className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-2xl font-mono">{stats.running}</p>
              <p className="text-xs text-muted-foreground">Running</p>
            </div>
          </div>
        </div>
      </div>

      {/* Account */}
      {account && (
        <div>
          <h2 className="text-base font-medium">Account</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Cloudflare credentials from cert.pem
          </p>
          <div className="border bg-card p-5 mt-3 space-y-3">
            <div className="flex items-center gap-3">
              <FingerprintIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Account ID</p>
                <p className="text-sm font-mono">{account.accountID}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <FingerprintIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Zone ID</p>
                <p className="text-sm font-mono">{account.zoneID}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Zones */}
      <div>
        <h2 className="text-base font-medium">Cloudflare Zones</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {zones.length} zone{zones.length !== 1 ? "s" : ""} available for
          tunnel domains
        </p>
      </div>

      <div className="border bg-card p-5 space-y-3">
        {zones.length > 0 ? (
          zones.map((zone) => (
            <div key={zone} className="flex items-center gap-3">
              <GlobeIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-mono">{zone}</span>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No zones found</p>
        )}
      </div>
    </div>
  )
}
