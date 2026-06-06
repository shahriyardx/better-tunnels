"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  PlayIcon,
  StopIcon,
  TrashIcon,
  PlusIcon,
  ArrowCounterClockwiseIcon,
  DotsThreeOutlineIcon,
  CircleIcon,
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
  const [deleting, setDeleting] = useState(false);

  const handleDelete = () => {
    if (!confirm(`Delete tunnel "${tunnel.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    onDelete(tunnel.id);
  };

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CircleIcon className={`h-2.5 w-2.5 fill-current ${STATUS_COLORS[tunnel.status]}`} weight="fill" />
              <h3 className="font-medium leading-none tracking-tight">{tunnel.name}</h3>
            </div>
            <p className="text-sm text-muted-foreground font-mono">{tunnel.domain}</p>
          </div>
          <span className="text-xs uppercase text-muted-foreground font-mono">{tunnel.status}</span>
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground font-mono">
          <span>→ {tunnel.target}:{tunnel.port}</span>
          {tunnel.pid && <span>pid {tunnel.pid}</span>}
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
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="gap-1.5 text-destructive hover:text-destructive"
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
      <div className="rounded-full bg-muted p-4 mb-4">
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
    <div className="grid auto-rows-min gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-5 space-y-4 animate-pulse">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="h-4 w-28 bg-muted rounded" />
              <div className="h-3 w-36 bg-muted rounded" />
            </div>
            <div className="h-3 w-12 bg-muted rounded" />
          </div>
          <div className="h-3 w-24 bg-muted rounded" />
          <div className="flex gap-2">
            <div className="h-8 w-16 bg-muted rounded-md" />
            <div className="h-8 w-16 bg-muted rounded-md" />
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
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
          </div>
          <div className="flex flex-1 items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-sm font-medium">Tunnels</h1>
              {tunnels.length > 0 && (
                <span className="text-xs text-muted-foreground font-mono">
                  {runningCount} running / {tunnels.length} total
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={fetchTunnels} title="Refresh">
                <ArrowCounterClockwiseIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => router.push("/dashboard/new")}
                className="gap-1.5"
              >
                <PlusIcon className="h-4 w-4" />
                New Tunnel
              </Button>
            </div>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4">
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
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
            <div className="grid auto-rows-min gap-4 md:grid-cols-2 lg:grid-cols-3">
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
      </SidebarInset>
    </SidebarProvider>
  );
}
