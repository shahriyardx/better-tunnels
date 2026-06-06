import { getTunnelLogs } from "@/lib/cloudflared";
import { NextRequest } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const lines = getTunnelLogs(id, 200);
  return Response.json({ lines });
}
