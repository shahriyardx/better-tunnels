"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import {
  PlayIcon,
  StopIcon,
  TrashIcon,
  CircleIcon,
  EyeIcon,
  CircleNotchIcon,
} from "@phosphor-icons/react"
import { api } from "@/trpc/react"

export type TunnelStatus = "stopped" | "running" | "error" | "creating"

export interface Tunnel {
  id: string
  name: string
  domain: string
  target: string
  port: number
  cloudflareTunnelId: string | null
  status: TunnelStatus
  pid: number | null
  createdAt: Date
  updatedAt: Date
}

const STATUS_COLORS: Record<TunnelStatus, string> = {
  running: "text-green-500",
  stopped: "text-gray-400",
  error: "text-red-500",
  creating: "text-yellow-500",
}

export function TunnelCard({ tunnel }: { tunnel: Tunnel }) {
  const router = useRouter()
  const utils = api.useUtils()

  const startMutation = api.tunnels.start.useMutation({
    onSuccess: () => utils.tunnels.list.invalidate(),
    onError: (err) => alert(err.message),
  })

  const stopMutation = api.tunnels.stop.useMutation({
    onSuccess: () => utils.tunnels.list.invalidate(),
    onError: (err) => alert(err.message),
  })

  const deleteMutation = api.tunnels.delete.useMutation({
    onSuccess: () => utils.tunnels.list.invalidate(),
    onError: (err) => alert(err.message),
  })

  return (
    <div className="rounded-none border bg-card text-card-foreground shadow-sm">
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CircleIcon
                className={`h-2.5 w-2.5 fill-current ${STATUS_COLORS[tunnel.status]}`}
                weight="fill"
              />
              <Link
                href={`/dashboard/tunnels/${tunnel.id}`}
                className="text-base font-medium hover:underline leading-none"
              >
                {tunnel.name}
              </Link>
            </div>
            <p className="text-sm text-muted-foreground font-mono">
              {tunnel.domain}
            </p>
          </div>
          <span className="text-xs uppercase text-muted-foreground font-mono">
            {tunnel.status}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Target</span>
            <p className="font-mono truncate">
              {tunnel.target}:{tunnel.port}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Tunnel ID</span>
            <p className="font-mono text-xs truncate">
              {tunnel.cloudflareTunnelId ?? "—"}
            </p>
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
              onClick={() => stopMutation.mutate(tunnel.id)}
              disabled={stopMutation.isPending}
              className="gap-1.5"
            >
              {stopMutation.isPending ? (
                <CircleNotchIcon className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <StopIcon className="h-3.5 w-3.5" />
              )}
              {stopMutation.isPending ? "Stopping..." : "Stop"}
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={() => startMutation.mutate(tunnel.id)}
              disabled={startMutation.isPending || tunnel.status === "creating"}
              className="gap-1.5"
            >
              {startMutation.isPending ? (
                <CircleNotchIcon className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <PlayIcon className="h-3.5 w-3.5" />
              )}
              {startMutation.isPending
                ? "Starting..."
                : tunnel.status === "creating"
                  ? "Starting..."
                  : "Start"}
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
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                disabled={
                  deleteMutation.isPending ||
                  stopMutation.isPending ||
                  startMutation.isPending
                }
                className="gap-1.5"
              >
                <TrashIcon className="h-3.5 w-3.5" />
                Delete
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete tunnel</DialogTitle>
                <DialogDescription>
                  Delete "{tunnel.name}"? This cannot be undone. The tunnel will
                  be removed from Cloudflare and your database.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" size="sm">
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(tunnel.id)}
                  className="gap-1.5"
                >
                  {deleteMutation.isPending ? (
                    <CircleNotchIcon className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  {deleteMutation.isPending ? "Deleting..." : "Delete"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  )
}
