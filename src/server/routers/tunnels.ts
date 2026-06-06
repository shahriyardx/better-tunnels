import { z } from "zod";
import { db } from "@/db";
import { tunnels } from "@/db/schema";
import {
  checkInstallation,
  createCloudflareTunnel,
  deleteCloudflareTunnel,
  deleteDnsRecord,
  getCloudflareApiToken,
  routeDnsViaApi,
  startTunnelProcess,
  stopTunnelProcess,
  getTunnelLogs,
  getAlivePids,
} from "@/lib/cloudflared";
import { eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { t } from "../trpc";

export const tunnelsRouter = t.router({
  list: t.procedure.query(async () => {
    return db.select().from(tunnels).orderBy(tunnels.createdAt);
  }),

  byId: t.procedure.input(z.string()).query(async ({ input: id }) => {
    const tunnel = await db
      .select()
      .from(tunnels)
      .where(eq(tunnels.id, id))
      .limit(1);
    if (!tunnel.length) {
      throw new Error("Tunnel not found");
    }
    return tunnel[0];
  }),

  create: t.procedure
    .input(
      z.object({
        name: z.string().min(1),
        domain: z.string().min(1),
        port: z.number().int().min(1).max(65535),
        target: z.string().default("localhost"),
      }),
    )
    .mutation(async ({ input }) => {
      const status = checkInstallation();
      if (!status.installed || !status.authenticated) {
        throw new Error(status.message ?? "cloudflared not ready");
      }

      const { name, domain, port, target } = input;

      let createdTunnelName: string | null = null;
      try {
        const { tunnelId } = createCloudflareTunnel(name);
        createdTunnelName = name;

        try {
          const apiToken = getCloudflareApiToken();
          await routeDnsViaApi(tunnelId, domain, apiToken);
        } catch (dnsErr) {
          deleteCloudflareTunnel(name);
          throw dnsErr;
        }

        const id = randomUUID();
        const tunnel = {
          id,
          name,
          domain,
          target,
          port,
          cloudflareTunnelId: tunnelId,
          status: "stopped" as const,
          pid: null as number | null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await db.insert(tunnels).values(tunnel);

        // Auto-start the tunnel after creation
        try {
          const { pid } = startTunnelProcess(
            id,
            name,
            tunnelId,
            domain,
            target,
            port,
          );
          await db
            .update(tunnels)
            .set({ status: "running", pid, updatedAt: new Date() })
            .where(eq(tunnels.id, id));
          return { ...tunnel, status: "running" as const, pid };
        } catch {
          // Auto-start failed, return tunnel as created but not running
          return tunnel;
        }
      } catch (err) {
        if (createdTunnelName) {
          try {
            deleteCloudflareTunnel(createdTunnelName);
          } catch { /* ignore */ }
        }
        throw new Error(
          err instanceof Error ? err.message : "Failed to create tunnel",
        );
      }
    }),

  delete: t.procedure.input(z.string()).mutation(async ({ input: id }) => {
    const tunnel = await db
      .select()
      .from(tunnels)
      .where(eq(tunnels.id, id))
      .limit(1);
    if (!tunnel.length) {
      throw new Error("Tunnel not found");
    }

    const t = tunnel[0];
    stopTunnelProcess(id);

    try {
      deleteCloudflareTunnel(t.name);
    } catch { /* may already be deleted */ }

    // Delete DNS CNAME record
    try {
      const apiToken = getCloudflareApiToken();
      await deleteDnsRecord(t.domain, apiToken);
    } catch { /* record may already be gone */ }

    await db.delete(tunnels).where(eq(tunnels.id, id));
  }),

  start: t.procedure.input(z.string()).mutation(async ({ input: id }) => {
    const status = checkInstallation();
    if (!status.installed || !status.authenticated) {
      throw new Error(status.message ?? "cloudflared not ready");
    }

    const tunnel = await db
      .select()
      .from(tunnels)
      .where(eq(tunnels.id, id))
      .limit(1);
    if (!tunnel.length) {
      throw new Error("Tunnel not found");
    }

    const t = tunnel[0];
    if (t.status === "running") {
      throw new Error("Tunnel already running");
    }

    if (!t.cloudflareTunnelId) {
      throw new Error("Cloudflare tunnel ID missing. Re-create the tunnel.");
    }

    try {
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

      return { pid, status: "running" as const };
    } catch (err) {
      await db
        .update(tunnels)
        .set({ status: "error", updatedAt: new Date() })
        .where(eq(tunnels.id, id));

      throw new Error(
        err instanceof Error ? err.message : "Failed to start tunnel",
      );
    }
  }),

  stop: t.procedure.input(z.string()).mutation(async ({ input: id }) => {
    const tunnel = await db
      .select()
      .from(tunnels)
      .where(eq(tunnels.id, id))
      .limit(1);
    if (!tunnel.length) {
      throw new Error("Tunnel not found");
    }

    stopTunnelProcess(id);

    await db
      .update(tunnels)
      .set({ status: "stopped", pid: null, updatedAt: new Date() })
      .where(eq(tunnels.id, id));

    return { status: "stopped" as const };
  }),

  logs: t.procedure.input(z.string()).query(async ({ input: id }) => {
    return getTunnelLogs(id, 200);
  }),

  reconcile: t.procedure.mutation(async () => {
    const alive = getAlivePids();
    const aliveIds = Object.keys(alive);

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

    return { alive: aliveIds.length, reconciled: dead.length };
  }),
});
