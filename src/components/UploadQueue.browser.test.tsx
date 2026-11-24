import { QueryClient, QueryClientProvider } from '@tanstack/solid-query'
import { render, waitFor } from '@solidjs/testing-library'
import { afterEach, describe, expect, test, vi } from 'vitest'

import UploadQueue from './UploadQueue'

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const renderUploadQueue = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(() => (
    <QueryClientProvider client={queryClient}>
      <UploadQueue dongleId="0000000000000000" />
    </QueryClientProvider>
  ))
}

describe('UploadQueue', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('disables Cancel all when only offline snapshot items are queued', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = input instanceof Request ? input.url : String(input)
      if (url.includes('athena_offline_queue')) {
        return jsonResponse([
          {
            method: 'uploadFilesToUrls',
            params: {
              files_data: [
                {
                  fn: '2026-01-01--00-00-00--0/rlog.zst',
                  url: 'https://upload.commadotai.com/dongle/0000000000000000/2026-01-01--00-00-00/0/rlog.zst',
                  headers: {},
                  priority: 0,
                  allow_cellular: false,
                },
              ],
            },
          },
        ])
      }
      const body = input instanceof Request ? await input.clone().text() : String(init?.body ?? '')
      if (body.includes('listUploadQueue')) {
        return jsonResponse({ jsonrpc: '2.0', id: 0, error: { code: -1, message: 'Device offline' } })
      }
      return jsonResponse({})
    })

    const { getByRole, getByText } = renderUploadQueue()

    await waitFor(() => {
      expect(getByText('Offline')).toBeTruthy()
    })
    const cancelAll = getByRole('button', { name: /cancel all/i }) as HTMLButtonElement
    expect(cancelAll.disabled).toBe(true)
  })

  test('shows and dismisses error banner when cancelUpload fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = input instanceof Request ? input.url : String(input)
      if (url.includes('athena_offline_queue')) {
        return jsonResponse([])
      }
      const body = input instanceof Request ? await input.clone().text() : String(init?.body ?? '')
      if (body.includes('listUploadQueue')) {
        return jsonResponse({
          jsonrpc: '2.0',
          id: 0,
          result: [
            {
              id: 'upload-1',
              path: '2026-01-01--00-00-00--0/rlog.zst',
              url: 'https://upload.commadotai.com/dongle/0000000000000000/2026-01-01--00-00-00/0/rlog.zst',
              headers: {},
              created_at: 1,
              current: false,
              progress: 0,
              retry_count: 0,
            },
          ],
        })
      }
      if (body.includes('cancelUpload')) {
        return jsonResponse({ jsonrpc: '2.0', id: 0, error: { code: -1, message: 'Athena timeout' } })
      }
      return jsonResponse({})
    })

    const { getByRole, getByText, getByTitle, queryByText } = renderUploadQueue()

    const cancelAll = getByRole('button', { name: /cancel all/i }) as HTMLButtonElement
    await waitFor(() => {
      expect(cancelAll.disabled).toBe(false)
    })

    cancelAll.click()

    await waitFor(() => {
      expect(getByText('Athena timeout')).toBeTruthy()
    })

    getByTitle('Dismiss').click()

    await waitFor(() => {
      expect(queryByText('Athena timeout')).toBeNull()
    })
  })
})
