import { ABLY_API_KEY } from "$env/static/private"
import { json } from "@sveltejs/kit"
import { Rest } from "ably"
import type { RequestHandler } from "./$types"

export const GET: RequestHandler = async ({ url }) => {
  const ably = new Rest({ key: ABLY_API_KEY })
  const clientId = url.searchParams.get("clientId") ?? undefined
  const tokenRequest = await ably.auth.createTokenRequest({ clientId })
  return json(tokenRequest)
}
