import { getCertAccountInfo } from "@/lib/cloudflared";

async function handler() {
  try {
    const info = getCertAccountInfo();
    return Response.json({
      accountID: info.accountID,
      zoneID: info.zoneID,
    });
  } catch {
    return Response.json({ accountID: null, zoneID: null });
  }
}

export const GET = handler;
export const POST = handler;
