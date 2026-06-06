"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  PlayIcon,
  StopIcon,
  TrashIcon,
  PlusIcon,
  ArrowCounterClockwiseIcon,
  DotsThreeOutlineIcon,
  CircleIcon,
  EyeIcon,
} from "@phosphor-icons/react";

type TunnelStatus = "stopped" | "running" | "error" | "creating";

interface Tunnel {
  id: string;
  name: string;
  domain: string;
  target: string;
  port: number;
  cloudflareTunnelId: string | null;
  status: TunnelStatus;
  pid: number | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_COLORS: Record<TunnelStatus, string> = {
  running: "text-green-500",
  stopped: "text-gray-400",
  error: "text-red-500",
  creating: "text-yellow-500",
};

function TunnelCard({
  tunnel,
  onStart,
  onStop,
  onDelete,
  loading,
}: {
  tunnel: Tunnel;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onDelete: (id: string) => void;
  loading: boolean;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = () => {
    if (!confirm(`Delete tunnel "${tunnel.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    onDelete(tunnel.id);
  };

  return (
    <div className="rounded-none border bg-card text-card-foreground shadow-sm">
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CircleIcon className={`h-2.5 w-2.5 fill-current ${STATUS_COLORS[tunnel.status]}`} weight="fill" />
              <button
                onClick={() => router.push(`/dashboard/tunnels/${tunnel.id}`)}
                className="text-base font-medium hover:underline text-left leading-none"
              >
                {tunnel.name}
              </button>
            </div>
            <p className="text-sm text-muted-foreground font-mono">{tunnel.domain}</p>
          </div>
          <span className="text-xs uppercase text-muted-foreground font-mono">{tunnel.status}</span>
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Target</span>
            <p className="font-mono truncate">{tunnel.target}:{tunnel.port}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Tunnel ID</span>
            <p className="font-mono text-xs truncate">{tunnel.cloudflareTunnelId ?? "—"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">PID</span>
            <p className="font-mono">{tunnel.pid ?? "—"}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {tunnel.status === "running" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onStop(tunnel.id)}
              disabled={loading}
              className="gap-1.5"
            >
              <StopIcon className="h-3.5 w-3.5" />
              Stop
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={() => onStart(tunnel.id)}
              disabled={loading || tunnel.status === "creating"}
              className="gap-1.5"
            >
              <PlayIcon className="h-3.5 w-3.5" />
              {tunnel.status === "creating" ? "Starting..." : "Start"}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/dashboard/tunnels/${tunnel.id}`)}
            className="gap-1.5"
          >
            <EyeIcon className="h-3.5 w-3.5" />
            View
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="gap-1.5"
          >
            <TrashIcon className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-none bg-muted p-4 mb-4">
        <DotsThreeOutlineIcon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-1">No tunnels yet</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm">
        Create your first Cloudflare Tunnel to expose a local service to the internet.
      </p>
    </div>
  );
}

function LoadingSkeleton() {
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

export default function DashboardPage() {
  const router = useRouter();
  const [tunnels, setTunnels] = useState<Tunnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchTunnels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tunnels");
      if (!res.ok) throw new Error(`Failed to fetch tunnels (${res.status})`);
      const data = await res.json();
      setTunnels(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tunnels");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Reconcile stale tunnel statuses (check if PIDs still alive)
    fetch("/api/tunnels/reconcile", { method: "POST" }).catch(() => {});
    fetchTunnels();
  }, [fetchTunnels]);

  // Poll status every 10s for running tunnels
  useEffect(() => {
    if (!tunnels.some((t) => t.status === "running")) return;
    const interval = setInterval(fetchTunnels, 10_000);
    return () => clearInterval(interval);
  }, [tunnels, fetchTunnels]);

  const handleStart = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/tunnels/${id}/start`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start tunnel");
      }
      await fetchTunnels();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to start tunnel");
    } finally {
      setActionLoading(null);
    }
  };

  const handleStop = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/tunnels/${id}/stop`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to stop tunnel");
      }
      await fetchTunnels();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to stop tunnel");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/tunnels/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete tunnel");
      }
      await fetchTunnels();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete tunnel");
    }
  };

  const runningCount = tunnels.filter((t) => t.status === "running").length;

  return (

        <div className="flex flex-1 flex-col gap-4 p-4">
          {error && (
            <div className="rounded-none border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              <p>{error}</p>
              <Button variant="outline" size="sm" onClick={fetchTunnels} className="mt-2">
                Retry
              </Button>
            </div>
          )}

          {loading ? (
            <LoadingSkeleton />
          ) : tunnels.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="flex flex-col gap-4">
              {tunnels.map((tunnel) => (
                <TunnelCard
                  key={tunnel.id}
                  tunnel={tunnel}
                  onStart={handleStart}
                  onStop={handleStop}
                  onDelete={handleDelete}
                  loading={actionLoading === tunnel.id}
                />
              ))}
            </div>
          )}
        </div>
  );
}
