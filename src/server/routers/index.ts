import { t } from "../trpc"
import { tunnelsRouter } from "./tunnels"
import { domainsRouter } from "./domains"
import { userRouter } from "./user"

export const appRouter = t.router({
  tunnels: tunnelsRouter,
  domains: domainsRouter,
  user: userRouter,
})

export type AppRouter = typeof appRouter
