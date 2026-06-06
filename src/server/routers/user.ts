import { t } from "../trpc"
import { getCertAccountInfo } from "@/lib/cloudflared"

export const userRouter = t.router({
  info: t.procedure.query(async () => {
    try {
      const info = getCertAccountInfo()
      return { accountID: info.accountID, zoneID: info.zoneID }
    } catch {
      return { accountID: null as string | null, zoneID: null as string | null }
    }
  }),
})
