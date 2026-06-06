import { checkInstallation, listZones } from "@/lib/cloudflared";
import { NextRequest } from "next/server";

export async function GET() {
  const status = checkInstallation();
  if (!status.installed || !status.authenticated) {
    return Response.json({
      error: status.message,
      installed: status.installed,
      authenticated: status.authenticated,
    }, { status: 400 });
  }

  try {
    const zones = await listZones();
    return Response.json({ domains: zones.map((z) => z.name), installed: true, authenticated: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch domains";
    return Response.json({ error: message, installed: true, authenticated: true }, { status: 500 });
  }
}
