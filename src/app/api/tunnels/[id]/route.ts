import { db } from "@/db";
import { tunnels } from "@/db/schema";
import { deleteCloudflareTunnel, stopTunnelProcess } from "@/lib/cloudflared";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const tunnel = await db.select().from(tunnels).where(eq(tunnels.id, id)).limit(1);
  if (!tunnel.length) {
    return Response.json({ error: "Tunnel not found" }, { status: 404 });
  }
  return Response.json(tunnel[0]);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const tunnel = await db.select().from(tunnels).where(eq(tunnels.id, id)).limit(1);
  if (!tunnel.length) {
    return Response.json({ error: "Tunnel not found" }, { status: 404 });
  }

  const t = tunnel[0];
  stopTunnelProcess(id);

  // Delete tunnel from Cloudflare
  try {
    deleteCloudflareTunnel(t.name);
  } catch {
    // may already be deleted
  }

  await db.delete(tunnels).where(eq(tunnels.id, id));
  return new Response(null, { status: 204 });
}
