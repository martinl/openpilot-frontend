import { createMemoryHistory, MemoryRouter, Route } from '@solidjs/router'
import { render, waitFor } from '@solidjs/testing-library'
import { afterEach, describe, expect, test, vi } from 'vitest'

import '~/index.css'
import SettingsActivity from './SettingsActivity'

const MOCK_DEVICE = {
  dongle_id: '0000000000000000',
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
  openpilot_version: '0.11.2',
  sim_id: '',
  sim_type: 0,
  eligible_features: { prime: false, prime_data: false, nav: false },
}

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

describe('SettingsActivity', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  test('renders Display Preferences above device settings and updates preferences', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input)
      if (url.endsWith('/users')) {
        return jsonResponse([{ email: 'driver@example.com', permission: 'owner' }])
      }
      if (url.includes('/v1/me/devices/')) {
        return jsonResponse([MOCK_DEVICE])
      }
      return jsonResponse(MOCK_DEVICE)
    })

    const history = createMemoryHistory()
    history.set({ value: '/0000000000000000/settings', scroll: false, replace: true })

    const { getByRole, getByText } = render(() => (
      <div class="bg-background text-on-background min-h-screen">
        <MemoryRouter history={history}>
          <Route path="/0000000000000000/settings" component={() => <SettingsActivity dongleId="0000000000000000" />} />
        </MemoryRouter>
      </div>
    ))

    await waitFor(() => {
      expect(getByText('Display Preferences')).toBeTruthy()
      expect(getByText('demo 3X')).toBeTruthy()
    })

    const displayHeading = getByText('Display Preferences')
    const deviceHeading = getByText('demo 3X')
    expect(displayHeading.compareDocumentPosition(deviceHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    const metricBtn = getByRole('radio', { name: 'Metric (km)' })
    metricBtn.click()
    expect(metricBtn.getAttribute('aria-checked')).toBe('true')

    const h24Btn = getByRole('radio', { name: '24-hour' })
    h24Btn.click()
    expect(h24Btn.getAttribute('aria-checked')).toBe('true')
  })
})
