import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { configure, render, waitFor } from '@solidjs/testing-library'

import { setAccessToken, signOut } from '~/api/auth/client'
import * as Demo from '~/api/auth/demo'
import { AppLayout, Routes } from './App'

const DEMO_LOG_ID = '000000dd--455f14369d'
const DEMO_FULLNAME = `${Demo.DONGLE_ID}|${DEMO_LOG_ID}`

const DEMO_DEVICE = {
  dongle_id: Demo.DONGLE_ID,
  alias: 'demo 3X',
  serial: 'demo-serial',
  last_athena_ping: Math.floor(Date.now() / 1000),
  ignore_uploads: null,
  is_paired: true,
  is_owner: true,
  public_key: '',
  prime: false,
  prime_type: 0,
  trial_claimed: false,
  device_type: 'threex',
  openpilot_version: '0.9.8',
  sim_id: '',
  sim_type: 0,
  eligible_features: { prime: false, prime_data: false, nav: false },
}

const DEMO_ROUTE = {
  create_time: 1735689600,
  dongle_id: Demo.DONGLE_ID,
  end_lat: 32.723695,
  end_lng: -117.168638,
  end_time: '2025-01-01T00:10:00',
  fullname: DEMO_FULLNAME,
  git_branch: 'master',
  git_commit: 'deadbeef',
  git_commit_date: '2025-01-01T00:00:00',
  git_dirty: false,
  git_remote: 'https://github.com/commaai/openpilot.git',
  is_preserved: false,
  is_public: true,
  maxqlog: 0,
  platform: 'HONDA_CIVIC',
  procqcamera: 0,
  procqlog: 0,
  proclog: 0,
  proccamera: 0,
  segment_end_times: [1735690200000],
  segment_numbers: [0],
  segment_start_times: [1735689600000],
  share_exp: '9999999999',
  share_sig: 'demosig',
  start_lat: 32.723695,
  start_lng: -117.168638,
  start_time: '2025-01-01T00:00:00',
  url: `https://api.konik.ai/connectdata/${Demo.DONGLE_ID}/${DEMO_LOG_ID}`,
  user_id: 'demo',
  version: '0.9.8',
  vin: 'DEMO1234567890',
}

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

const renderApp = (location: string) => render(() => <Routes />, { location, wrapper: AppLayout })

beforeAll(() => configure({ asyncUtilTimeout: 3000 }))
beforeEach(() => signOut())

test('Show login page', async () => {
  const { findByText } = renderApp('/')
  expect(await findByText('Sign in with GitHub')).toBeTruthy()
})

describe('Demo mode', () => {
  const originalFetch = window.fetch.bind(window)

  beforeEach(() => {
    setAccessToken(Demo.ACCESS_TOKEN)
    vi.spyOn(window, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      if (url.endsWith('/v1/me/devices/')) return jsonResponse([DEMO_DEVICE])
      if (url.includes(`/devices/${Demo.DONGLE_ID}/routes_segments`)) return jsonResponse([DEMO_ROUTE])
      if (url.includes(`/devices/${Demo.DONGLE_ID}/routes/preserved`)) return jsonResponse([])
      if (url.includes(`/devices/${Demo.DONGLE_ID}/stats`)) {
        return jsonResponse({
          all: { distance: 100, minutes: 60, routes: 5 },
          week: { distance: 20, minutes: 15, routes: 1 },
        })
      }
      if (url.includes(`/devices/${Demo.DONGLE_ID}/location`)) {
        return jsonResponse({ lat: 32.723695, lng: -117.168638, time: Date.now(), accuracy: 1, speed: 0, bearing: 0 })
      }
      if (url.includes(`/devices/${Demo.DONGLE_ID}/`)) return jsonResponse(DEMO_DEVICE)
      if (url.endsWith('/v1/me/')) {
        return jsonResponse({ email: 'demo@konik.ai', id: 'demo', regdate: 0, superuser: false, user_id: 'demo' })
      }
      if (url.includes('/share_signature')) return jsonResponse({ exp: '9999999999', sig: 'demosig' })
      if (url.includes('/files')) return jsonResponse({ cameras: [], dcameras: [], ecameras: [], logs: [] })
      if (url.includes('/v1/route/')) return jsonResponse(DEMO_ROUTE)
      if (url.endsWith('/events.json') || url.endsWith('/coords.json')) return jsonResponse([])
      if (url.includes('/ws/')) return jsonResponse({ jsonrpc: '2.0', id: 0, result: {} })
      return originalFetch(input, init)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('View dashboard', async () => {
    const { findByText } = renderApp('/')
    expect(await findByText('demo 3X')).toBeTruthy()
  })

  test('View demo route', async () => {
    const { findByText, findByTestId } = renderApp(`/${Demo.DONGLE_ID}/${DEMO_LOG_ID}`)
    expect(await findByText(DEMO_LOG_ID)).toBeTruthy()
    const video = (await findByTestId('route-video')) as HTMLVideoElement
    await waitFor(() => expect(video.src).toBeTruthy())
  })
})

describe.skip('Public routes', () => {
  test('View shared device', async () => {
    const { findByText } = renderApp(`/${Demo.DONGLE_ID}`)
    expect(await findByText('Not signed in')).toBeTruthy()
    expect(await findByText('Shared Device')).toBeTruthy()
  })

  test('View public route without signing in', async () => {
    const { findByText } = renderApp(`/${Demo.DONGLE_ID}/${DEMO_LOG_ID}`)
    expect(await findByText(DEMO_LOG_ID)).toBeTruthy()
  })
})
