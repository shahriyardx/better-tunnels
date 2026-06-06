import { db } from "@/db";
import { tunnels } from "@/db/schema";
import { stopTunnelProcess } from "@/lib/cloudflared";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const tunnel = await db.select().from(tunnels).where(eq(tunnels.id, id)).limit(1);
  if (!tunnel.length) {
    return Response.json({ error: "Tunnel not found" }, { status: 404 });
  }

  stopTunnelProcess(id);

  await db
    .update(tunnels)
    .set({ status: "stopped", pid: null, updatedAt: new Date() })
    .where(eq(tunnels.id, id));

  return Response.json({ status: "stopped" });
}
