"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TerminalIcon } from "@phosphor-icons/react";
import { api } from "@/trpc/react";

export default function HomePage() {
  const router = useRouter();
  const { data, isLoading } = api.domains.list.useQuery();

  useEffect(() => {
    if (data?.authenticated) {
      router.push("/dashboard");
    }
  }, [data, router]);

  if (isLoading || data?.authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <TerminalIcon className="h-4 w-4 animate-pulse" />
          Checking setup...
        </div>
      </div>
    );
  }

  const status = {
    installed: data?.installed ?? false,
    authenticated: data?.authenticated ?? false,
    message: data?.error || "cloudflared not detected",
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="max-w-md w-full space-y-6">
        <div className="flex items-center gap-3 mb-8">
          <TerminalIcon className="h-6 w-6" />
          <h1 className="text-lg font-medium">BetterTunnels</h1>
        </div>

        <div className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-sm font-medium">Getting Started</h2>

          {!status.installed && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">1</span>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Install cloudflared</p>
                  <p className="text-xs text-muted-foreground">
                    Download and install the Cloudflare Tunnel client for your OS.
                  </p>
                  <a
                    href="https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-primary underline underline-offset-4"
                  >
                    developers.cloudflare.com
                  </a>
                </div>
              </div>
            </div>
          )}

          {status.installed && !status.authenticated && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">2</span>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Authenticate with Cloudflare</p>
                  <p className="text-xs text-muted-foreground">
                    Run this command in your terminal and log in via the browser.
                  </p>
                  <pre className="mt-2 rounded-lg bg-muted p-3 text-xs font-mono">cloudflared tunnel login</pre>
                </div>
              </div>
            </div>
          )}

          {status.message && (
            <p className="text-xs text-muted-foreground">{status.message}</p>
          )}
        </div>

        {status.installed && !status.authenticated && (
          <p className="text-xs text-muted-foreground text-center">
            After authenticating, refresh this page.
          </p>
        )}
      </div>
    </div>
  );
}
