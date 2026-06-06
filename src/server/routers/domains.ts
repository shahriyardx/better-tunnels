import { t } from "../trpc"
import { checkInstallation, getCloudflareApiToken } from "@/lib/cloudflared"

export const domainsRouter = t.router({
  list: t.procedure.query(async () => {
    const status = checkInstallation()
    if (!status.installed || !status.authenticated) {
      return {
        zones: [] as string[],
        installed: status.installed,
        authenticated: status.authenticated,
        error: status.message,
      }
    }

    try {
      const token = getCloudflareApiToken()
      const res = await fetch(
        "https://api.cloudflare.com/client/v4/zones?per_page=50",
        { headers: { Authorization: `Bearer ${token}` } },
      )
      const data = (await res.json()) as {
        success: boolean
        result: Array<{ name: string }>
      }
      const zones =
        data.success && data.result ? data.result.map((z) => z.name) : []
      return {
        zones,
        installed: true,
        authenticated: true,
        error: null as string | null,
      }
    } catch {
      return {
        zones: [] as string[],
        installed: true,
        authenticated: true,
        error: null as string | null,
      }
    }
  }),
})
