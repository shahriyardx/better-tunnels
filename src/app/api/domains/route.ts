import { checkInstallation, getCloudflareApiToken } from "@/lib/cloudflared";

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
    const token = getCloudflareApiToken();
    const res = await fetch("https://api.cloudflare.com/client/v4/zones?per_page=50", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json() as { success: boolean; result: Array<{ name: string }> };
    const zones = data.success && data.result ? data.result.map((z) => z.name) : [];
    return Response.json({ zones, installed: true, authenticated: true });
  } catch {
    return Response.json({ zones: [], installed: true, authenticated: true });
  }
}
