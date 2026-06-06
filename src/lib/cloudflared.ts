import { execSync, spawn } from "node:child_process";
import { writeFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const CLOUDTUNNEL_DIR = path.join(homedir(), ".cloudtunnel");
const CONFIGS_DIR = path.join(CLOUDTUNNEL_DIR, "configs");

function ensureDirs() {
  if (!existsSync(CLOUDTUNNEL_DIR)) mkdirSync(CLOUDTUNNEL_DIR, { recursive: true });
  if (!existsSync(CONFIGS_DIR)) mkdirSync(CONFIGS_DIR, { recursive: true });
}

function execCloudflared(args: string[]): string {
  return execSync(`cloudflared ${args.join(" ")}`, {
    encoding: "utf-8",
    timeout: 30_000,
  });
}

export function checkInstallation() {
  try {
    execSync("cloudflared version", { encoding: "utf-8", timeout: 5_000 });
    // Check for credentials file
    const credsPath = path.join(homedir(), ".cloudflared", "cert.pem");
    if (!existsSync(credsPath)) {
      return { installed: true, authenticated: false, message: "cloudflared installed but not authenticated. Run `cloudflared tunnel login`." };
    }
    return { installed: true, authenticated: true, message: null };
  } catch {
    return { installed: false, authenticated: false, message: "cloudflared not found. Install from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/" };
  }
}

export function createCloudflareTunnel(name: string) {
  const output = execCloudflared(["tunnel", "create", name]);
  // Output: "Created tunnel <name> with id <uuid>"
  const match = output.match(/id\s+([a-f0-9-]+)/);
  if (!match) throw new Error(`Failed to parse tunnel ID from output: ${output}`);
  return { tunnelId: match[1], credentialsPath: path.join(homedir(), ".cloudflared", `${match[1]}.json`) };
}

export function deleteCloudflareTunnel(name: string) {
  execCloudflared(["tunnel", "delete", "-f", name]);
}

export function routeDns(name: string, domain: string) {
  execCloudflared(["tunnel", "route", "dns", name, domain]);
}

// Create DNS CNAME via Cloudflare API (more reliable zone matching)
export async function routeDnsViaApi(domain: string, tunnelId: string): Promise<void> {
  const token = getCloudflareApiToken();

  // Get all zones, find the longest suffix match
  const res = await fetch("https://api.cloudflare.com/client/v4/zones?per_page=100", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json() as { success: boolean; result: Array<{ id: string; name: string }> };
  if (!data.success || !data.result?.length) throw new Error("No Cloudflare zones found");

  // Sort by name length desc, find first suffix match
  const zones = data.result.sort((a, b) => b.name.length - a.name.length);
  const match = zones.find((z) => domain.endsWith(`.${z.name}`) || domain === z.name);
  if (!match) throw new Error(`No Cloudflare zone found for domain "${domain}". Add it to Cloudflare DNS first.`);

  const zoneId = match.id;
  const recordName = domain; // Full domain as the record name

  // Check if CNAME already exists
  const checkRes = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=CNAME&name=${encodeURIComponent(recordName)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const checkData = await checkRes.json() as { success: boolean; result: Array<{ id: string }> };

  if (checkData.success && checkData.result?.length) {
    // Already exists - update it
    await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${checkData.result[0].id}`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "CNAME",
          name: recordName,
          content: `${tunnelId}.cfargottunnel.com`,
          proxied: true,
          ttl: 120,
        }),
      },
    );
    return;
  }

  // Create new CNAME
  const createRes = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "CNAME",
        name: recordName,
        content: `${tunnelId}.cfargottunnel.com`,
        proxied: true,
        ttl: 120,
      }),
    },
  );
  const createData = await createRes.json() as { success: boolean };
  if (!createData.success) throw new Error(`Failed to create DNS record for ${domain}`);
}

export function getCloudflareApiToken(): string {
  const certPath = path.join(homedir(), ".cloudflared", "cert.pem");
  if (!existsSync(certPath)) throw new Error("cloudflared cert.pem not found. Run `cloudflared tunnel login`.");
  const raw = readFileSync(certPath, "utf-8");
  // New format: base64-encoded ARGO TUNNEL TOKEN
  const b64 = raw.replace(/-----BEGIN[^]+?-----/g, "").replace(/-----END[^]+?-----/g, "").replace(/\s/g, "");
  if (b64) {
    try {
      const decoded = JSON.parse(Buffer.from(b64, "base64").toString());
      if (decoded.apiToken) return decoded.apiToken;
    } catch { /* fall through */ }
  }
  // Legacy format: plain JSON
  try {
    const cert = JSON.parse(raw);
    if (cert.apiToken || cert.APIToken) return cert.apiToken || cert.APIToken;
  } catch { /* fall through */ }
  throw new Error("Could not extract API token from cert.pem. Re-run `cloudflared tunnel login`.");
}

export async function listZones(): Promise<{ name: string; id: string }[]> {
  const token = getCloudflareApiToken();
  const res = await fetch(
    "https://api.cloudflare.com/client/v4/zones?per_page=100",
    { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } },
  );
  const data = await res.json() as { success: boolean; result: Array<{ id: string; name: string }> };
  if (!data.success || !data.result) return [];
  return data.result.map((z) => ({ name: z.name, id: z.id }));
}

export async function deleteDnsRecord(domain: string): Promise<void> {
  const token = getCloudflareApiToken();
  const zoneName = domain.split(".").slice(-2).join("."); // tunnel.shahriyar.dev → shahriyar.dev

  // Get zone ID
  const zoneRes = await fetch(
    `https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(zoneName)}`,
    { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } },
  );
  const zoneData = await zoneRes.json() as { success: boolean; result: Array<{ id: string }> };
  if (!zoneData.success || !zoneData.result?.length) {
    return; // Can't find zone, skip
  }
  const zoneId = zoneData.result[0].id;

  // Find CNAME record for the domain
  const recordRes = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=CNAME&name=${encodeURIComponent(domain)}`,
    { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } },
  );
  const recordData = await recordRes.json() as { success: boolean; result: Array<{ id: string }> };
  if (!recordData.success || !recordData.result?.length) {
    return; // No matching record, skip
  }

  // Delete all matching CNAME records
  for (const record of recordData.result) {
    await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${record.id}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      },
    );
  }
}

function generateConfigYml(tunnelId: string, credentialsPath: string, domain: string, target: string, port: number): string {
  return `tunnel: ${tunnelId}
credentials-file: ${credentialsPath}

ingress:
  - hostname: ${domain}
    service: http://${target}:${port}
  - service: http_status:404
`;
}

// --- Process Manager ---
const PIDS_PATH = path.join(CLOUDTUNNEL_DIR, "pids.json");

function readPids(): Record<string, number> {
  try {
    return JSON.parse(readFileSync(PIDS_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function writePids(pids: Record<string, number>) {
  writeFileSync(PIDS_PATH, JSON.stringify(pids, null, 2));
}

export function startTunnelProcess(tunnelId: string, name: string, cloudflareTunnelId: string, domain: string, target: string, port: number): { pid: number } {
  ensureDirs();

  const credentialsPath = path.join(homedir(), ".cloudflared", `${cloudflareTunnelId}.json`);
  const ymlPath = path.join(CONFIGS_DIR, `${name}.yml`);

  // Verify credentials file exists — without it cloudflared exits immediately
  if (!existsSync(credentialsPath)) {
    throw new Error(`Tunnel credentials not found at ${credentialsPath}. Re-create the tunnel.`);
  }

  const yml = generateConfigYml(cloudflareTunnelId, credentialsPath, domain, target, port);
  writeFileSync(ymlPath, yml, "utf-8");

  const proc = spawn("cloudflared", ["tunnel", "--config", ymlPath, "run", "--protocol", "http2"], {
    stdio: "ignore",
    detached: true,
  });
  proc.unref();

  const pid = proc.pid!;

  // Persist PID to file
  const pids = readPids();
  pids[tunnelId] = pid;
  writePids(pids);

  // Check if process exits quickly (<2s) — indicates startup failure
  const deadTimer = setTimeout(() => {
    // Tunnel stayed alive past startup window, good
  }, 2_000);
  deadTimer.unref();

  proc.on("exit", () => {
    const p = readPids();
    delete p[tunnelId];
    writePids(p);
  });

  proc.on("error", () => {
    const p = readPids();
    delete p[tunnelId];
    writePids(p);
  });

  return { pid };
}

export function stopTunnelProcess(tunnelId: string) {
  const pids = readPids();
  const pid = pids[tunnelId];
  if (pid) {
    try {
      process.kill(pid, "SIGTERM");
    } catch { /* process already dead */ }
    delete pids[tunnelId];
    writePids(pids);
    return true;
  }
  return false;
}

// Check if any tracked PIDs are still alive
export function getAlivePids(): Record<string, number> {
  const pids = readPids();
  const alive: Record<string, number> = {};
  for (const [id, pid] of Object.entries(pids)) {
    try {
      process.kill(pid, 0);
      // Verify it's actually a cloudflared process
      const comm = readFileSync(`/proc/${pid}/comm`, "utf-8").trim();
      if (comm === "cloudflared") {
        alive[id] = pid;
      } else {
        delete pids[id];
      }
    } catch {
      delete pids[id];
    }
  }
  writePids(pids);
  return alive;
}

export function isProcessRunning(tunnelId: string): boolean {
  const pids = readPids();
  const pid = pids[tunnelId];
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    // Verify it's actually a cloudflared process, not PID reuse
    const comm = readFileSync(`/proc/${pid}/comm`, "utf-8").trim();
    return comm === "cloudflared";
  } catch {
    return false;
  }
}

export function getLogs(_tunnelId: string): string[] {
  return [];
}

export function getRunningPids(): Record<string, number> {
  return getAlivePids();
}
