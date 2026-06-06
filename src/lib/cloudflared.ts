import { execSync, spawn } from "node:child_process";
import { writeFileSync, existsSync, mkdirSync, readFileSync, createWriteStream } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const CLOUDTUNNEL_DIR = path.join(homedir(), ".bettertunnels");
const CONFIGS_DIR = path.join(CLOUDTUNNEL_DIR, "configs");
const LOGS_DIR = path.join(CLOUDTUNNEL_DIR, "logs");

function ensureDirs() {
  if (!existsSync(CLOUDTUNNEL_DIR)) mkdirSync(CLOUDTUNNEL_DIR, { recursive: true });
  if (!existsSync(CONFIGS_DIR)) mkdirSync(CONFIGS_DIR, { recursive: true });
  if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });
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

export async function routeDnsViaApi(tunnelId: string, domain: string, apiToken: string) {
  const parts = domain.split(".");
  const zoneName = parts.slice(-2).join(".");

  // 1. Get zone ID for the domain
  const zonesRes = await fetch(
    `https://api.cloudflare.com/client/v4/zones?name=${zoneName}`,
    { headers: { Authorization: `Bearer ${apiToken}` } }
  );
  const zonesData = await zonesRes.json() as { success: boolean; result: Array<{ id: string; name: string }> };
  const zone = zonesData.result?.[0];
  if (!zone) throw new Error(`Zone not found for domain: ${zoneName}`);

  // 2. Try to create CNAME record pointing to the tunnel
  const body = JSON.stringify({
    type: "CNAME",
    name: domain,
    content: `${tunnelId}.cfargotunnel.com`,
    proxied: true,
    ttl: 1,
  });

  const recordRes = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zone.id}/dns_records`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body,
    }
  );

  const recordData = await recordRes.json() as { success: boolean; errors?: Array<{ code: number }> };

  if (!recordData.success) {
    // Error code 81057 = record already exists, so patch it instead
    const alreadyExists = recordData.errors?.some((e) => e.code === 81057);

    if (alreadyExists) {
      const listRes = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${zone.id}/dns_records?name=${domain}&type=CNAME`,
        { headers: { Authorization: `Bearer ${apiToken}` } }
      );
      const listData = await listRes.json() as { success: boolean; result: Array<{ id: string }> };
      const recordId = listData.result?.[0]?.id;

      if (!recordId) throw new Error(`CNAME record exists but could not be found for: ${domain}`);

      const patchRes = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${zone.id}/dns_records/${recordId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: `${tunnelId}.cfargotunnel.com`,
            proxied: true,
          }),
        }
      );

      const patchData = await patchRes.json() as { success: boolean; errors?: Array<{ message: string }> };
      if (!patchData.success) {
        throw new Error(`Failed to update existing CNAME record: ${JSON.stringify(patchData.errors)}`);
      }
    } else {
      throw new Error(`DNS record creation failed: ${JSON.stringify(recordData.errors)}`);
    }
  }
}

export function getCloudflareApiToken(): string {
  const certPath = path.join(homedir(), ".cloudflared", "cert.pem");
  if (!existsSync(certPath)) throw new Error("cloudflared cert.pem not found. Run `cloudflared tunnel login`.");
  const raw = readFileSync(certPath, "utf-8");
  // New format: base64-encoded ARGO TUNNEL TOKEN
  const b64 = raw.replace(/-----BEGIN[\s\S]*?-----/g, "").replace(/-----END[\s\S]*?-----/g, "").replace(/\s/g, "");
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

export function getCertAccountInfo(): { accountID: string; zoneID: string } {
  const certPath = path.join(homedir(), ".cloudflared", "cert.pem");
  if (!existsSync(certPath)) throw new Error("cert.pem not found. Run `cloudflared tunnel login`.");
  const raw = readFileSync(certPath, "utf-8");
  const b64 = raw.replace(/-----BEGIN[\s\S]*?-----/g, "").replace(/-----END[\s\S]*?-----/g, "").replace(/\s/g, "");
  const decoded = JSON.parse(Buffer.from(b64, "base64").toString());
  return { accountID: decoded.accountID || "", zoneID: decoded.zoneID || "" };
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

  // Pipe logs to file for live viewing
  const logPath = path.join(LOGS_DIR, `${tunnelId}.log`);
  const logStream = createWriteStream(logPath, { flags: "a" });

  const proc = spawn("cloudflared", ["tunnel", "--config", ymlPath, "run", "--protocol", "http2"], {
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  proc.stdout.pipe(logStream);
  proc.stderr.pipe(logStream);
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

export function getTunnelLogs(tunnelId: string, lines: number = 100): string[] {
  const logPath = path.join(LOGS_DIR, `${tunnelId}.log`);
  if (!existsSync(logPath)) return [];
  try {
    const content = readFileSync(logPath, "utf-8");
    const all = content.split("\n").filter(Boolean);
    return all.slice(-lines);
  } catch {
    return [];
  }
}

export function getRunningPids(): Record<string, number> {
  return getAlivePids();
}
