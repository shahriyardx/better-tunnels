import { getCloudflareApiToken } from "@/lib/cloudflared";

async function handler() {
  try {
    const token = getCloudflareApiToken();
    const res = await fetch("https://api.cloudflare.com/client/v4/user", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json() as { success: boolean; result: { email: string; username?: string } };
    if (data.success && data.result) {
      return Response.json({
        name: data.result.username || data.result.email.split("@")[0],
        email: data.result.email,
      });
    }
  } catch { /* fall through */ }
  return Response.json({ name: "cloudtunnel", email: "local" });
}

export const GET = handler;
export const POST = handler;
