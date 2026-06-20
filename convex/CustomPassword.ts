import { ConvexError } from "convex/values"
import { Password } from "@convex-dev/auth/providers/Password"
import type { GenericDataModel } from "convex/server"

export function CustomPassword<DataModel extends GenericDataModel = GenericDataModel>(
  config?: Parameters<typeof Password<DataModel>>[0],
) {
  const base = Password(config)
  // The real authorize function is stored in `options` by ConvexCredentials.
  // The library's `providerDefaults` calls `merge(provider, options)`, which
  // would overwrite our wrapped authorize with the original — so we strip it.
  const options = { ...(base as any).options }
  const realAuthorize = options.authorize
  delete options.authorize
  return {
    ...base,
    options,
    authorize: async (params: Record<string, any>, ctx: any) => {
      try {
        return await realAuthorize(params, ctx)
      } catch (error) {
        if (error instanceof Error && (
          error.message === "InvalidAccountId" ||
          error.message === "InvalidSecret"
        )) {
          throw new ConvexError("Email atau password salah")
        }
        if (error instanceof Error && error.message === "TooManyFailedAttempts") {
          throw new ConvexError("Terlalu banyak percobaan. Silakan coba lagi nanti.")
        }
        throw new ConvexError("Email atau password salah")
      }
    },
  } as typeof base
}
