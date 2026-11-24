import type { AthenaCallResponse, BackendAthenaCallResponse, BackendAthenaCallResponseError } from '~/api/types'
import { fetcher } from '.'
import { ATHENA_URL } from './config'

const normalizeAthenaError = (err: unknown): string => {
  if (typeof err === 'string') return err

  if (err && typeof err === 'object') {
    const anyErr = err as Record<string, unknown>

    // `fetcher()` throws `Error(message, { cause })`.
    const cause = anyErr?.cause
    if (cause && typeof cause === 'object') {
      const anyCause = cause as Record<string, unknown>
      if (typeof anyCause.error === 'string') return anyCause.error
      if (typeof anyCause.description === 'string') return anyCause.description
      if (typeof anyCause.message === 'string') return anyCause.message
    }

    if (typeof anyErr.message === 'string' && anyErr.message) return anyErr.message
    if (typeof anyErr.description === 'string') return anyErr.description
    if (typeof anyErr.error === 'string') return anyErr.error

    try {
      return JSON.stringify(err)
    } catch {
      return 'Athena call failed'
    }
  }

  return 'Athena call failed'
}

export const getNetworkMetered = (dongleId: string) => makeAthenaCall<void, boolean>(dongleId, 'getNetworkMetered')

export const getPeripheralState = (dongleId: string) =>
  makeAthenaCall<{ service: string; timeout: number }, { peripheralState: { voltage: number } }>(dongleId, 'getMessage', {
    service: 'peripheralState',
    timeout: 5000,
  })

export const setRouteViewed = (dongleId: string, route: string) =>
  makeAthenaCall<{ route: string }, void>(dongleId, 'setRouteViewed', { route })

export const takeSnapshot = (dongleId: string) =>
  makeAthenaCall<
    void,
    {
      jpegFront?: string
      jpegBack?: string
    }
  >(dongleId, 'takeSnapshot')

export interface StartStreamResult {
  sdp?: string
  time?: number
  error?: string
  message?: string
}

export const startStream = (dongleId: string, sdp: string, enabled = true) =>
  makeAthenaCall<{ sdp: string; enabled: boolean }, StartStreamResult>(dongleId, 'startStream', { sdp, enabled })

const TURN_CACHE_TTL_MS = 55 * 60 * 1000
let cachedTurnServers: RTCIceServer[] | null = null
let cachedTurnAt = 0

export const getTurnIceServers = async (fallback: RTCIceServer[]): Promise<RTCIceServer[]> => {
  if (cachedTurnServers && Date.now() - cachedTurnAt < TURN_CACHE_TTL_MS) {
    return cachedTurnServers
  }
  try {
    const resp = await fetcher<{ iceServers?: RTCIceServer[] }>('/v1/me/turn')
    if (Array.isArray(resp?.iceServers) && resp.iceServers.length > 0) {
      cachedTurnServers = resp.iceServers
      cachedTurnAt = Date.now()
      return resp.iceServers
    }
  } catch {
    // Backend may not implement /v1/me/turn; fall back to configured STUN/TURN servers.
  }
  return fallback
}

export const makeAthenaCall = async <REQ, RES>(
  dongleId: string,
  method: string,
  params?: REQ,
  expiry?: number,
): Promise<AthenaCallResponse<RES>> => {
  let res: BackendAthenaCallResponse<RES> | BackendAthenaCallResponseError
  try {
    res = await fetcher<BackendAthenaCallResponse<RES> | BackendAthenaCallResponseError>(
      `/${dongleId}`,
      {
        method: 'POST',
        body: JSON.stringify({ id: 0, jsonrpc: '2.0', method, params, expiry }),
        headers: { 'Content-Type': 'application/json' },
      },
      ATHENA_URL,
    )
  } catch (err) {
    return { queued: false, error: normalizeAthenaError(err), result: undefined }
  }
  if ('error' in res) {
    return { queued: false, error: normalizeAthenaError(res.error), result: undefined }
  }
  if (typeof res.result === 'string' && res.result === 'Device offline, message queued') {
    return { queued: true, error: undefined, result: undefined }
  }
  return { queued: false, error: undefined, result: res.result as RES }
}
