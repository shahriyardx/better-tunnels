"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  PlayIcon,
  StopIcon,
  TrashIcon,
  CircleIcon,
  TerminalIcon,
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

export default function TunnelDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [tunnel, setTunnel] = useState<Tunnel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Fetch tunnel details
  useEffect(() => {
    if (!id) return;
    fetch(`/api/tunnels/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Tunnel not found");
        return r.json();
      })
      .then((data) => setTunnel(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  // Poll logs every 2s
  useEffect(() => {
    if (!id) return;
    const poll = () => {
      fetch(`/api/tunnels/${id}/logs`)
        .then((r) => r.json())
        .then((data) => {
          if (data.lines) setLogs(data.lines);
        })
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, 2_000);
    return () => clearInterval(interval);
  }, [id]);

  // Auto-scroll log to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleStart = async () => {
    if (!tunnel) return;
    setActionLoading(true);
    setTunnel({ ...tunnel, status: "creating" });
    try {
      const res = await fetch(`/api/tunnels/${id}/start`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start");
      }
      const data = await res.json();
      setTunnel((prev) => prev ? { ...prev, status: "running", pid: data.pid } : null);
    } catch (err) {
      setTunnel((prev) => prev ? { ...prev, status: "error" } : null);
      alert(err instanceof Error ? err.message : "Failed to start");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    if (!tunnel) return;
    setActionLoading(true);
    try {
      await fetch(`/api/tunnels/${id}/stop`, { method: "POST" });
      setTunnel((prev) => prev ? { ...prev, status: "stopped", pid: null } : null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to stop");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this tunnel?")) return;
    setActionLoading(true);
    try {
      await fetch(`/api/tunnels/${id}`, { method: "DELETE" });
      router.push("/dashboard");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">Loading tunnel...</p>
      </div>
    );
  }

  if (error || !tunnel) {
    return (
      <div className="p-4 text-sm text-destructive">{error}</div>
    );
  }

  return (

        <div className="flex flex-1 flex-col gap-4 p-4">
          {/* Tunnel info card */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CircleIcon className={`h-3 w-3 fill-current ${STATUS_COLORS[tunnel.status]}`} weight="fill" />
                  <h2 className="text-base font-medium">{tunnel.name}</h2>
                </div>
                <p className="text-sm text-muted-foreground font-mono">{tunnel.domain}</p>
              </div>
              <span className="text-xs uppercase text-muted-foreground font-mono">{tunnel.status}</span>
            </div>

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Target</span>
                <p className="font-mono">{tunnel.target}:{tunnel.port}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Tunnel ID</span>
                <p className="font-mono text-xs truncate">{tunnel.cloudflareTunnelId}</p>
              </div>
              <div>
                <span className="text-muted-foreground">PID</span>
                <p className="font-mono">{tunnel.pid ?? "—"}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {tunnel.status === "running" ? (
                <Button variant="outline" size="sm" onClick={handleStop} disabled={actionLoading} className="gap-1.5">
                  <StopIcon className="h-3.5 w-3.5" />
                  Stop
                </Button>
              ) : (
                <Button variant="default" size="sm" onClick={handleStart} disabled={actionLoading} className="gap-1.5">
                  <PlayIcon className="h-3.5 w-3.5" />
                  Start
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={handleDelete} disabled={actionLoading} className="gap-1.5 text-destructive hover:text-destructive">
                <TrashIcon className="h-3.5 w-3.5" />
                Delete
              </Button>
            </div>
          </div>

          {/* Live logs */}
          <div className="rounded-xl border bg-card">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <div className="flex items-center gap-2 text-sm font-medium">
                <TerminalIcon className="h-4 w-4" />
                Live Logs
              </div>
              <span className="text-xs text-muted-foreground">{logs.length} lines</span>
            </div>
            <div className="p-4 max-h-[500px] overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {tunnel.status === "running"
                    ? "Waiting for logs..."
                    : "Start tunnel to see logs."}
                </p>
              ) : (
                <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap break-all">
                  {logs.join("\n")}
                  <div ref={logEndRef} />
                </pre>
              )}
            </div>
          </div>
        </div>
  );
}
