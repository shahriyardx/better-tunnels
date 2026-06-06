"use client";

import { useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  PlayIcon,
  StopIcon,
  TrashIcon,
  CircleIcon,
  TerminalIcon,
} from "@phosphor-icons/react";
import { api } from "@/trpc/react";

type TunnelStatus = "stopped" | "running" | "error" | "creating";

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
  const logEndRef = useRef<HTMLDivElement>(null);
  const utils = api.useUtils();

  const { data: tunnel, isLoading, error } = api.tunnels.byId.useQuery(id);
  const { data: logs = [] } = api.tunnels.logs.useQuery(id, {
    refetchInterval: 2_000,
  });

  const startMutation = api.tunnels.start.useMutation({
    onSuccess: () => {
      utils.tunnels.byId.invalidate(id);
      utils.tunnels.list.invalidate();
    },
    onError: (err) => alert(err.message),
  });

  const stopMutation = api.tunnels.stop.useMutation({
    onSuccess: () => {
      utils.tunnels.byId.invalidate(id);
      utils.tunnels.list.invalidate();
    },
    onError: (err) => alert(err.message),
  });

  const deleteMutation = api.tunnels.delete.useMutation({
    onSuccess: () => router.push("/dashboard"),
    onError: (err) => alert(err.message),
  });

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">Loading tunnel...</p>
      </div>
    );
  }

  if (error || !tunnel) {
    return (
      <div className="p-4 text-sm text-destructive">{error?.message ?? "Tunnel not found"}</div>
    );
  }

  const actionLoading = startMutation.isPending || stopMutation.isPending || deleteMutation.isPending;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      {/* Tunnel info card */}
      <div className="rounded-none border bg-card p-5 space-y-4">
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
            <Button variant="outline" size="sm" onClick={() => stopMutation.mutate(id)} disabled={actionLoading} className="gap-1.5">
              <StopIcon className="h-3.5 w-3.5" />
              Stop
            </Button>
          ) : (
            <Button variant="default" size="sm" onClick={() => startMutation.mutate(id)} disabled={actionLoading} className="gap-1.5">
              <PlayIcon className="h-3.5 w-3.5" />
              Start
            </Button>
          )}
          <Button variant="destructive" size="sm" onClick={() => {
            if (confirm("Delete this tunnel?")) deleteMutation.mutate(id);
          }} disabled={actionLoading} className="gap-1.5">
            <TrashIcon className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>

      {/* Live logs */}
      <div className="rounded-none border bg-card">
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
