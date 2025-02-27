import { env } from "$env/dynamic/private"
import { json } from "@sveltejs/kit"
import { Rest } from "ably"
import type { RequestHandler } from "./$types"

export const GET: RequestHandler = async ({ url }) => {
  const ably = new Rest({ key: env.ABLY_API_KEY })
  const clientId = url.searchParams.get("clientId") ?? undefined
  const tokenRequest = await ably.auth.createTokenRequest({ clientId })
  return json(tokenRequest)
}
