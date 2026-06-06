import { db } from "@/db";
import { tunnels } from "@/db/schema";
import { checkInstallation, createCloudflareTunnel, deleteCloudflareTunnel, getCloudflareApiToken, routeDnsViaApi } from "@/lib/cloudflared";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";

export async function GET() {
  const all = await db.select().from(tunnels).orderBy(tunnels.createdAt);
  return Response.json(all);
}

export async function POST(request: NextRequest) {
  const status = checkInstallation();
  if (!status.installed || !status.authenticated) {
    return Response.json({ error: status.message }, { status: 400 });
  }

  const body = await request.json();
  const { name, domain, port, target = "localhost" } = body;

  if (!name || !domain || !port) {
    return Response.json({ error: "name, domain, and port are required" }, { status: 400 });
  }

  if (port < 1 || port > 65535) {
    return Response.json({ error: "port must be between 1 and 65535" }, { status: 400 });
  }

  let createdTunnelName: string | null = null;
  try {
    const { tunnelId } = createCloudflareTunnel(name);
    createdTunnelName = name;

    try {
      const apiToken = getCloudflareApiToken();
      await routeDnsViaApi(tunnelId, domain, apiToken);
    } catch (dnsErr) {
      // Rollback: delete tunnel if DNS routing fails
      deleteCloudflareTunnel(name);
      throw dnsErr;
    }

    const tunnel = {
      id: randomUUID(),
      name,
      domain,
      target,
      port,
      cloudflareTunnelId: tunnelId,
      status: "stopped" as const,
      pid: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(tunnels).values(tunnel);
    return Response.json(tunnel, { status: 201 });
  } catch (err) {
    // Ensure cleanup if tunnel was created but something else failed
    if (createdTunnelName) {
      try { deleteCloudflareTunnel(createdTunnelName); } catch { /* ignore */ }
    }
    const message = err instanceof Error ? err.message : "Failed to create tunnel";
    return Response.json({ error: message }, { status: 500 });
  }
}
