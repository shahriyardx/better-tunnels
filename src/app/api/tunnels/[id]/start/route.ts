import { db } from "@/db";
import { tunnels } from "@/db/schema";
import {
  checkInstallation,
  startTunnelProcess,
} from "@/lib/cloudflared";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const status = checkInstallation();
  if (!status.installed || !status.authenticated) {
    return Response.json({ error: status.message }, { status: 400 });
  }

  const { id } = await params;
  const tunnel = await db.select().from(tunnels).where(eq(tunnels.id, id)).limit(1);
  if (!tunnel.length) {
    return Response.json({ error: "Tunnel not found" }, { status: 404 });
  }

  const t = tunnel[0];
  if (t.status === "running") {
    return Response.json({ error: "Tunnel already running" }, { status: 409 });
  }

  try {
    if (!t.cloudflareTunnelId) {
      return Response.json({ error: "Cloudflare tunnel ID missing. Re-create the tunnel." }, { status: 400 });
    }
    const { pid } = startTunnelProcess(
      t.id,
      t.name,
      t.cloudflareTunnelId,
      t.domain,
      t.target,
      t.port,
    );
    await db
      .update(tunnels)
      .set({ status: "running", pid, updatedAt: new Date() })
      .where(eq(tunnels.id, id));

    return Response.json({ pid, status: "running" });
  } catch (err) {
    await db
      .update(tunnels)
      .set({ status: "error", updatedAt: new Date() })
      .where(eq(tunnels.id, id));

    const message = err instanceof Error ? err.message : "Failed to start tunnel";
    return Response.json({ error: message }, { status: 500 });
  }
}
