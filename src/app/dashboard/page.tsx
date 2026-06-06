"use client";

import { useEffect, useState } from "react";
import { GlobeIcon, CloudIcon, TerminalIcon, FingerprintIcon } from "@phosphor-icons/react";

interface TunnelStats {
  total: number;
  running: number;
}

export default function OverviewPage() {
  const [zones, setZones] = useState<string[]>([]);
  const [stats, setStats] = useState<TunnelStats | null>(null);
  const [account, setAccount] = useState<{ accountID: string; zoneID: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/domains").then((r) => r.json()),
      fetch("/api/tunnels").then((r) => r.json()),
      fetch("/api/user").then((r) => r.json()),
    ])
      .then(([domainData, tunnelData, userData]) => {
        if (domainData.zones) setZones(domainData.zones);
        if (Array.isArray(tunnelData)) {
          setStats({
            total: tunnelData.length,
            running: tunnelData.filter((t: any) => t.status === "running").length,
          });
        }
        if (userData.accountID) setAccount(userData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">Loading overview...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 max-w-xl">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border bg-card p-5">
          <div className="flex items-center gap-3">
            <TerminalIcon className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-mono">{stats?.total ?? 0}</p>
              <p className="text-xs text-muted-foreground">Total Tunnels</p>
            </div>
          </div>
        </div>
        <div className="border bg-card p-5">
          <div className="flex items-center gap-3">
            <CloudIcon className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-2xl font-mono">{stats?.running ?? 0}</p>
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
          {zones.length} zone{zones.length !== 1 ? "s" : ""} available for tunnel domains
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
  );
}
