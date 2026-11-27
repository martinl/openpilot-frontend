import { createMemoryHistory, MemoryRouter, Route } from '@solidjs/router'
import { QueryClient, QueryClientProvider } from '@tanstack/solid-query'
import { render, waitFor } from '@solidjs/testing-library'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { setAccessToken, signOut } from '~/api/auth/client'
import '~/index.css'
import RouteActivity from './RouteActivity'

const DONGLE = '0000000000000000'
const DATE_STR = '2026-01-01--00-00-00'
const jsonResponse = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })

describe('RouteActivity', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    signOut()
  })

  test('renders route info, share link, files browser, and details', async () => {
    setAccessToken('test-token')
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input)
      if (url.endsWith('/files')) {
        return jsonResponse({
          cameras: [`https://example.com/${DONGLE}/${DATE_STR}/0/fcamera.hevc`, `https://example.com/${DONGLE}/${DATE_STR}/1/fcamera.hevc`],
          dcameras: [],
          ecameras: [],
          logs: [`https://example.com/${DONGLE}/${DATE_STR}/0/rlog.zst`],
          qcameras: [],
          qlogs: [`https://example.com/${DONGLE}/${DATE_STR}/0/qlog.zst`],
        })
      }
      if (url.includes('preserved')) return jsonResponse([])
      if (url.endsWith('/v1/me/')) return jsonResponse({ email: 'driver@example.com', superuser: false })
      if (url.includes(`/v1.1/devices/${DONGLE}/`)) return jsonResponse({ dongle_id: DONGLE, is_owner: true, alias: 'demo 3X' })
      if (url.includes('/events.json') || url.includes('/coords.json')) return jsonResponse([])
      if (url.includes('/v1/route/')) {
        return jsonResponse({
          fullname: `${DONGLE}|${DATE_STR}`,
          dongle_id: DONGLE,
          start_time: '2026-01-01T12:00:00',
          end_time: '2026-01-01T12:02:00',
          start_time_utc_millis: 1767268800000,
          end_time_utc_millis: 1767268920000,
          maxqlog: 1,
          length: 1.5,
          is_public: false,
          platform: 'TOYOTA COROLLA TSS2',
          git_remote: 'https://github.com/commaai/openpilot.git',
          git_branch: 'master',
          git_commit: 'abc1234567',
          version: '0.11.2',
          url: `https://example.com/${DONGLE}/${DATE_STR}`,
          start_lat: 32.7,
          start_lng: -117.1,
          end_lat: 32.8,
          end_lng: -117.2,
        })
      }
      return jsonResponse({})
    })

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const history = createMemoryHistory()
    history.set({ value: `/${DONGLE}/${DATE_STR}`, scroll: false, replace: true })

    const { getByText } = render(() => (
      <QueryClientProvider client={queryClient}>
        <div class="min-h-screen bg-background text-on-background">
          <MemoryRouter history={history}>
            <Route
              path={`/${DONGLE}/${DATE_STR}`}
              component={() => <RouteActivity dongleId={DONGLE} dateStr={DATE_STR} startTime={0} endTime={undefined} />}
            />
          </MemoryRouter>
        </div>
      </QueryClientProvider>
    ))

    await waitFor(() => {
      expect(getByText('Copy share link')).toBeTruthy()
      expect(getByText('Road camera')).toBeTruthy()
      expect(getByText('TOYOTA COROLLA TSS2')).toBeTruthy()
    })
  })
})
