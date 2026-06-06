import { db } from "@/db";
import { tunnels } from "@/db/schema";
import { getAlivePids } from "@/lib/cloudflared";
import { eq, inArray } from "drizzle-orm";

export async function POST() {
  const alive = getAlivePids();
  const aliveIds = Object.keys(alive);

  // tunnels marked as running but no alive PID → set to stopped
  const running = await db
    .select({ id: tunnels.id })
    .from(tunnels)
    .where(eq(tunnels.status, "running"));

  const dead = running
    .filter((t) => !aliveIds.includes(t.id))
    .map((t) => t.id);

  if (dead.length > 0) {
    await db
      .update(tunnels)
      .set({ status: "stopped", pid: null, updatedAt: new Date() })
      .where(inArray(tunnels.id, dead));
  }

  return Response.json({
    alive: aliveIds.length,
    reconciled: dead.length,
  });
}
