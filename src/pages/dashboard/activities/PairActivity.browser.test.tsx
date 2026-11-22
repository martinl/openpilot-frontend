import { afterEach, describe, expect, test, vi } from 'vitest'
import { render, waitFor } from '@solidjs/testing-library'
import { createMemoryHistory, MemoryRouter, Route } from '@solidjs/router'

import PairActivity from './PairActivity'

const createSyntheticCameraStream = () => {
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 480
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#22c55e'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(160, 120, 320, 240)
  }
  return canvas.captureStream(30)
}

const renderPairActivity = () => {
  const history = createMemoryHistory()
  history.set({ value: '/pair', scroll: false, replace: true })
  return render(() => (
    <MemoryRouter history={history}>
      <Route path="/pair" component={() => <PairActivity onPaired={vi.fn()} />} />
      <Route path="/" component={() => <div>Home</div>} />
    </MemoryRouter>
  ))
}

describe('PairActivity QR scanner', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('renders visible camera video stream and stops tracks on unmount', async () => {
    const stream = createSyntheticCameraStream()
    const tracks = stream.getTracks()
    const stopSpies = tracks.map((track) => vi.spyOn(track, 'stop'))

    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(stream)
    vi.spyOn(navigator.mediaDevices, 'enumerateDevices').mockResolvedValue([
      {
        deviceId: 'cam-back',
        groupId: 'g1',
        kind: 'videoinput',
        label: 'Back Camera',
        toJSON: () => ({}),
      },
      {
        deviceId: 'cam-front',
        groupId: 'g2',
        kind: 'videoinput',
        label: 'Front Camera',
        toJSON: () => ({}),
      },
    ])

    const { unmount } = renderPairActivity()

    await waitFor(
      () => {
        const video = document.querySelector('#video-container video') as HTMLVideoElement | null
        expect(video).toBeTruthy()
        expect(video!.srcObject).toBeInstanceOf(MediaStream)
        expect(video!.videoWidth).toBeGreaterThan(0)
        expect(video!.readyState).toBeGreaterThanOrEqual(2)

        const rect = video!.getBoundingClientRect()
        expect(rect.width).toBeGreaterThan(0)
        expect(rect.height).toBeGreaterThan(0)

        const style = window.getComputedStyle(video!)
        expect(style.display).not.toBe('none')
        expect(style.visibility).toBe('visible')
        expect(style.opacity).toBe('1')
      },
      { timeout: 5000 },
    )

    // Camera selector should appear when multiple cameras exist
    await waitFor(() => {
      const select = document.querySelector('select[aria-label="Select camera"]') as HTMLSelectElement | null
      expect(select).toBeTruthy()
      expect(select!.options.length).toBe(2)
    })

    // Unmount should release all camera tracks cleanly
    unmount()
    for (const spy of stopSpies) {
      expect(spy).toHaveBeenCalled()
    }
  })

  test('shows error state and allows retrying when camera fails', async () => {
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValue(new Error('Permission denied'))

    const { findByText } = renderPairActivity()
    expect(await findByText(/An error occurred:/)).toBeTruthy()
    expect(await findByText('Retry')).toBeTruthy()
  })
})
