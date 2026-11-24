import { createEffect, createSignal, For, onCleanup, onMount, Show, type VoidComponent } from 'solid-js'
import clsx from 'clsx'

import { getTurnIceServers, startStream } from '~/api/athena'
import Button from '~/components/material/Button'
import Icon from '~/components/material/Icon'
import IconButton from '~/components/material/IconButton'
import TopAppBar from '~/components/material/TopAppBar'
import { appConfig } from '~/config'

type CameraKey = 'wideRoad' | 'driver'
type QualityKey = 'auto' | 'high' | 'med' | 'low'
type ConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'failed'

const CAMERAS: { key: CameraKey; label: string }[] = [
  { key: 'wideRoad', label: 'Road' },
  { key: 'driver', label: 'Cabin' },
]

const QUALITIES: { key: QualityKey; label: string }[] = [
  { key: 'auto', label: 'Auto' },
  { key: 'high', label: 'High (5 Mbps)' },
  { key: 'med', label: 'Med (1.5 Mbps)' },
  { key: 'low', label: 'Low (500 kbps)' },
]

const CONNECTION_DEADLINE_MS = 15_000
const ICE_GATHER_DEADLINE_MS = 8_000

// Drop mDNS (.local) host candidates from an SDP — the comma device cannot resolve them.
function stripMdnsCandidates(sdp: string): string {
  return sdp
    .split(/\r\n|\n/)
    .filter((line) => {
      if (!line.startsWith('a=candidate:')) return true
      return !line.split(' ')[4]?.endsWith('.local')
    })
    .map((line) => line.replace(/[\w-]+\.local\b/g, '0.0.0.0'))
    .join('\r\n')
}

const LiveVideoPlayer: VoidComponent<{
  stream: MediaStream | null
  onVideoElement?: (el: HTMLVideoElement | null) => void
}> = (props) => {
  let hostRef!: HTMLDivElement
  let videoEl: HTMLVideoElement | undefined

  onMount(() => {
    // Create <video> imperatively via document.createElement to avoid Safari's
    // WebKit <template>.cloneNode(true) black-screen bug on MediaStreams.
    const video = document.createElement('video')
    video.className = 'size-full object-contain bg-black'
    video.setAttribute('playsinline', '')
    video.setAttribute('webkit-playsinline', '')
    video.setAttribute('muted', '')
    video.setAttribute('autoplay', '')
    video.autoplay = true
    video.muted = true
    video.playsInline = true
    hostRef.appendChild(video)
    videoEl = video
    props.onVideoElement?.(video)
  })

  createEffect(() => {
    if (!videoEl) return
    const stream = props.stream
    if (videoEl.srcObject !== stream) {
      videoEl.srcObject = stream
    }
    if (stream) {
      void videoEl.play().catch(() => {})
    }
  })

  onCleanup(() => {
    props.onVideoElement?.(null)
    if (videoEl) {
      videoEl.srcObject = null
      videoEl.remove()
      videoEl = undefined
    }
  })

  return <div ref={hostRef} class="relative aspect-video w-full overflow-hidden rounded-lg bg-black" />
}

const LiveViewActivity: VoidComponent<{ dongleId: string }> = (props) => {
  const [connState, setConnState] = createSignal<ConnectionState>('idle')
  const [status, setStatus] = createSignal<string | null>(null)
  const [error, setError] = createSignal<string | null>(null)
  const [stream, setStream] = createSignal<MediaStream | null>(null)
  const [activeCamera, setActiveCamera] = createSignal<CameraKey>('wideRoad')
  const [quality, setQuality] = createSignal<QualityKey>('auto')
  const [rttMs, setRttMs] = createSignal<number | null>(null)

  let pc: RTCPeerConnection | null = null
  let dc: RTCDataChannel | null = null
  let connectionTimer: number | undefined
  let videoEl: HTMLVideoElement | null = null
  let cleanedUp = false

  const clearTimer = () => {
    if (connectionTimer !== undefined) {
      window.clearTimeout(connectionTimer)
      connectionTimer = undefined
    }
  }

  const sendDc = (type: string, data: Record<string, unknown>) => {
    if (dc?.readyState === 'open') {
      dc.send(JSON.stringify({ type, data }))
      return true
    }
    return false
  }

  const teardown = (nextState: ConnectionState = 'disconnected', reason?: string) => {
    clearTimer()
    if (dc) {
      try {
        sendDc('livestreamVideoEnable', { enabled: false })
        dc.close()
      } catch (_) {}
      dc = null
    }
    if (pc) {
      try {
        pc.close()
      } catch (_) {}
      pc = null
    }
    setStream(null)
    setConnState(nextState)
    setStatus(null)
    if (reason) setError(reason)
  }

  const connect = async () => {
    if (!props.dongleId || cleanedUp) return
    teardown('connecting')
    setError(null)
    setRttMs(null)
    setStatus('Gathering ICE candidates...')

    const iceServers = await getTurnIceServers(appConfig.iceServers)
    if (cleanedUp) return

    try {
      const peer = new RTCPeerConnection({ iceServers, bundlePolicy: 'max-bundle' })
      pc = peer

      connectionTimer = window.setTimeout(() => {
        if (pc === peer && connState() === 'connecting') {
          teardown('failed', 'Timed out connecting to device. Check network/TURN configuration and retry.')
        }
      }, CONNECTION_DEADLINE_MS)

      peer.addEventListener('track', (evt) => {
        if (pc !== peer || evt.track.kind !== 'video') return
        if (evt.receiver) {
          const receiver = evt.receiver as RTCRtpReceiver & { playoutDelayHint?: number; jitterBufferTarget?: number }
          if ('playoutDelayHint' in receiver) receiver.playoutDelayHint = 0
          if ('jitterBufferTarget' in receiver) receiver.jitterBufferTarget = 0
        }
        setStream(new MediaStream([evt.track]))
      })

      peer.addEventListener('connectionstatechange', () => {
        if (pc !== peer) return
        if (peer.connectionState === 'connected') {
          clearTimer()
          setConnState('connected')
          setStatus(null)
        } else if (peer.connectionState === 'failed' || peer.connectionState === 'disconnected' || peer.connectionState === 'closed') {
          teardown('failed', 'Connection lost')
        }
      })

      const transceiver = peer.addTransceiver('video', { direction: 'recvonly' })
      const codecs = RTCRtpReceiver.getCapabilities?.('video')?.codecs ?? []
      const h264Codecs = codecs.filter((c) => c.mimeType === 'video/H264')
      if (h264Codecs.length > 0 && 'setCodecPreferences' in transceiver) {
        transceiver.setCodecPreferences(h264Codecs)
      }

      const channel = peer.createDataChannel('data', { ordered: true })
      dc = channel
      channel.onopen = () => {
        if (pc !== peer) return
        sendDc('livestreamVideoEnable', { enabled: true })
        if (activeCamera() !== 'wideRoad') {
          sendDc('livestreamCameraSwitch', { camera: activeCamera() })
        }
        if (quality() !== 'auto') {
          sendDc('livestreamSettings', { quality: quality() })
        }
      }
      channel.onmessage = (evt) => {
        if (pc !== peer) return
        try {
          const raw = typeof evt.data === 'string' ? evt.data : new TextDecoder().decode(evt.data as ArrayBuffer)
          const msg = JSON.parse(raw) as { type?: string; data?: unknown }
          if (msg.type === 'disconnect') {
            teardown('disconnected', typeof msg.data === 'string' ? msg.data : 'Connection replaced by another session.')
          }
        } catch {
          // ignore malformed data channel messages
        }
      }

      const offer = await peer.createOffer()
      if (pc !== peer || cleanedUp) return
      await peer.setLocalDescription(offer)
      if (pc !== peer || cleanedUp) return

      await Promise.race([
        new Promise<void>((resolve) => {
          if (peer.iceGatheringState === 'complete') {
            resolve()
            return
          }
          peer.addEventListener('icecandidate', (evt) => {
            if (!evt.candidate || evt.candidate.type === 'relay') {
              resolve()
            }
          })
        }),
        new Promise<void>((resolve) => window.setTimeout(resolve, ICE_GATHER_DEADLINE_MS)),
      ])
      if (pc !== peer || cleanedUp) return

      const localSdp = peer.localDescription?.sdp
      if (!localSdp) throw new Error('Failed to generate local WebRTC offer.')

      setStatus('Contacting device via Athena...')
      const startedAt = performance.now()
      const resp = await startStream(props.dongleId, stripMdnsCandidates(localSdp), true)
      if (pc !== peer || cleanedUp) return

      if (resp.queued) {
        teardown('failed', 'Device is offline.')
        return
      }
      if (resp.error) {
        const msg = resp.error.toLowerCase().includes('method not found')
          ? 'This device does not support upstream live streaming (requires openpilot 0.11.2+).'
          : resp.error
        teardown('failed', msg)
        return
      }
      if (resp.result?.error === 'busy') {
        teardown('failed', resp.result.message || 'Device is busy with another live stream session.')
        return
      }
      if (!resp.result?.sdp) {
        teardown('failed', resp.result?.message || 'Device did not return a valid WebRTC answer.')
        return
      }

      setRttMs(Math.round(performance.now() - startedAt))
      setStatus('Establishing peer connection...')
      await peer.setRemoteDescription({ type: 'answer', sdp: resp.result.sdp })
    } catch (err) {
      if (!cleanedUp) {
        teardown('failed', err instanceof Error ? err.message : String(err))
      }
    }
  }

  const switchCamera = (cam: CameraKey) => {
    setActiveCamera(cam)
    sendDc('livestreamCameraSwitch', { camera: cam })
  }

  const changeQuality = (next: QualityKey) => {
    setQuality(next)
    sendDc('livestreamSettings', { quality: next })
  }

  const saveScreenshot = () => {
    if (!videoEl || !videoEl.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = videoEl.videoWidth
    canvas.height = videoEl.videoHeight
    canvas.getContext('2d')?.drawImage(videoEl, 0, 0)
    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')
    link.download = `livestream_${props.dongleId}_${activeCamera()}_${Date.now()}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  onMount(() => {
    const onVisibility = () => {
      if (document.hidden && connState() === 'connected') {
        teardown('disconnected')
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    onCleanup(() => {
      cleanedUp = true
      document.removeEventListener('visibilitychange', onVisibility)
      teardown('disconnected')
    })
  })

  const isConnected = () => connState() === 'connected'
  const isConnecting = () => connState() === 'connecting'

  return (
    <div class="flex flex-col">
      <TopAppBar component="h2" leading={<IconButton class="md:hidden" name="arrow_back" href={`/${props.dongleId}`} />}>
        Live Stream
      </TopAppBar>

      <div class="flex flex-col gap-4 px-4 pb-6">
        <Show when={error()}>
          <div class="flex items-center gap-2 rounded-md bg-error-container px-4 py-3 text-sm text-on-error-container">
            <Icon name="error" size="20" />
            <span>{error()}</span>
          </div>
        </Show>

        <Show
          when={stream() || isConnecting()}
          fallback={
            <div class="flex aspect-video w-full flex-col items-center justify-center gap-4 rounded-lg bg-surface-container-low p-6 text-center">
              <Icon name="videocam" size="48" class="text-on-surface-variant" />
              <div class="flex flex-col gap-1">
                <span class="text-lg font-medium text-on-surface">Live camera stream</span>
                <span class="text-sm text-on-surface-variant">
                  Stream real-time road or cabin video from your device (openpilot 0.11.2+).
                </span>
              </div>
              <Button color="primary" leading={<Icon name="videocam" />} onClick={() => void connect()}>
                Start Live Stream
              </Button>
            </div>
          }
        >
          <div class="relative">
            <LiveVideoPlayer
              stream={stream()}
              onVideoElement={(el) => {
                videoEl = el
              }}
            />
            <Show when={isConnecting() && !stream()}>
              <div class="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-black/70 text-white">
                <Icon name="autorenew" class="animate-spin" size="40" />
                <span class="text-sm">{status() ?? 'Connecting...'}</span>
              </div>
            </Show>
          </div>
        </Show>

        <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-container-low p-3">
          <div class="inline-flex rounded-md bg-surface-container-high p-1 gap-1" role="radiogroup" aria-label="Camera">
            <For each={CAMERAS}>
              {(cam) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={activeCamera() === cam.key}
                  disabled={!isConnected()}
                  class={clsx(
                    'rounded-sm px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50',
                    activeCamera() === cam.key
                      ? 'bg-primary text-on-primary'
                      : 'text-on-surface-variant hover:bg-surface-container-highest',
                  )}
                  onClick={() => switchCamera(cam.key)}
                >
                  {cam.label}
                </button>
              )}
            </For>
          </div>

          <div class="flex items-center gap-2">
            <select
              aria-label="Stream quality"
              disabled={!isConnected()}
              class="rounded-md bg-surface-container-high px-3 py-1.5 text-sm text-on-surface disabled:opacity-50"
              value={quality()}
              onChange={(e) => changeQuality(e.currentTarget.value as QualityKey)}
            >
              <For each={QUALITIES}>{(q) => <option value={q.key}>{q.label}</option>}</For>
            </select>

            <IconButton name="camera" title="Save screenshot" aria-label="Save screenshot" disabled={!stream()} onClick={saveScreenshot} />

            <Show
              when={isConnected() || isConnecting()}
              fallback={
                <Button color="primary" onClick={() => void connect()}>
                  Connect
                </Button>
              }
            >
              <Button color="error" onClick={() => teardown('disconnected')}>
                Disconnect
              </Button>
            </Show>
          </div>
        </div>

        <Show when={rttMs() !== null}>
          <div class="text-xs text-on-surface-variant">Signaling RTT: {rttMs()} ms</div>
        </Show>
      </div>
    </div>
  )
}

export default LiveViewActivity
