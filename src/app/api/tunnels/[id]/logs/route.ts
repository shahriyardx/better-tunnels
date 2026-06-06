import { getLogs } from "@/lib/cloudflared";
import { NextRequest } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const logs = getLogs(id);
  return Response.json({ logs });
}
