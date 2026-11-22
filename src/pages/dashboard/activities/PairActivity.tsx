import { createSignal, For, onCleanup, onMount, Show, type JSX, type VoidComponent } from 'solid-js'
import { useLocation, useNavigate } from '@solidjs/router'
import { createMachine } from '@solid-primitives/state-machine'
import QrScanner from 'qr-scanner'

import { pairDevice } from '~/api/devices'
import Button from '~/components/material/Button'
import Icon from '~/components/material/Icon'
import IconButton from '~/components/material/IconButton'
import TopAppBar from '~/components/material/TopAppBar'

import './PairActivity.css'

const toError = (error: unknown): Error => {
  if (error instanceof Error) return error
  if (typeof error === 'string') return new Error(error)
  return new Error('An unknown error occurred', { cause: error })
}

const stopVideoTracks = (video: HTMLVideoElement | undefined) => {
  if (!video) return
  const stream = video.srcObject
  if (stream instanceof MediaStream) {
    for (const track of stream.getTracks()) {
      track.stop()
    }
    video.srcObject = null
  }
}

const openCameraStream = async (deviceId?: string): Promise<MediaStream> => {
  const attempts: MediaStreamConstraints[] = deviceId
    ? [{ video: { deviceId: { exact: deviceId } }, audio: false }]
    : [
        { video: { facingMode: { ideal: 'environment' } }, audio: false },
        { video: true, audio: false },
      ]

  let lastError: unknown
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError ?? new Error('Camera not found.')
}

const QrScannerView: VoidComponent<{
  onScan: (pairToken: string) => void
  onError: (error: Error) => void
}> = (props) => {
  let videoHostRef!: HTMLDivElement
  let videoRef: HTMLVideoElement | undefined
  let qrScanner: QrScanner | undefined
  let cleanedUp = false

  const [cameras, setCameras] = createSignal<QrScanner.Camera[]>([])
  const [selectedCamera, setSelectedCamera] = createSignal<string>('')
  const [isReady, setIsReady] = createSignal(false)

  const markReady = () => {
    if (videoRef && videoRef.videoWidth > 0) {
      setIsReady(true)
    }
  }

  const handleLoadedMetadata = () => {
    markReady()
    if (videoRef?.paused) {
      void videoRef.play().catch(() => {})
    }
  }

  const startStream = async (deviceId?: string) => {
    if (!videoRef) return
    stopVideoTracks(videoRef)
    const stream = await openCameraStream(deviceId)
    if (cleanedUp || !videoRef) {
      for (const track of stream.getTracks()) track.stop()
      return
    }
    videoRef.srcObject = stream
    await videoRef.play()
    markReady()
  }

  const handleCameraChange = (cameraId: string) => {
    setSelectedCamera(cameraId)
    setIsReady(false)
    void startStream(cameraId).catch((reason) => {
      if (cleanedUp) return
      const error = toError(reason)
      console.error('Error switching QR scanner camera', error, error.cause)
      props.onError(error)
    })
  }

  onMount(() => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      props.onError(new Error('Camera access requires a secure context (HTTPS or localhost).'))
      return
    }

    // Create <video> imperatively via document.createElement instead of JSX (<template>.cloneNode),
    // working around a WebKit bug where cloned <video> elements render MediaStreams solid black in Safari.
    const video = document.createElement('video')
    video.className = 'pointer-events-none absolute inset-0 block size-full object-cover'
    video.setAttribute('playsinline', '')
    video.setAttribute('webkit-playsinline', '')
    video.setAttribute('muted', '')
    video.setAttribute('autoplay', '')
    video.autoplay = true
    video.muted = true
    video.playsInline = true
    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('loadeddata', markReady)
    video.addEventListener('canplay', markReady)
    video.addEventListener('playing', markReady)
    videoHostRef.appendChild(video)
    videoRef = video

    qrScanner = new QrScanner(
      video,
      (result) => {
        if (cleanedUp) return
        cleanedUp = true
        try {
          qrScanner?.destroy()
        } catch (_) {}
        stopVideoTracks(videoRef)
        props.onScan(result.data)
      },
      {
        highlightScanRegion: true,
      },
    )

    void startStream()
      .then(async () => {
        if (cleanedUp) {
          try {
            qrScanner?.destroy()
          } catch (_) {}
          stopVideoTracks(videoRef)
          return
        }
        await qrScanner?.start()
        if (cleanedUp) {
          try {
            qrScanner?.destroy()
          } catch (_) {}
          stopVideoTracks(videoRef)
          return
        }
        try {
          const available = await QrScanner.listCameras(false)
          if (cleanedUp) return
          setCameras(available)
          const activeTrack = (videoRef?.srcObject as MediaStream | null)?.getVideoTracks?.()[0]
          const activeDeviceId = activeTrack?.getSettings?.().deviceId
          if (activeDeviceId) {
            setSelectedCamera(activeDeviceId)
          } else if (available[0]) {
            setSelectedCamera(available[0].id)
          }
        } catch (_) {
          // Camera enumeration is optional; scanning still works without the selector.
        }
      })
      .catch((reason) => {
        if (cleanedUp) return
        const error = toError(reason)
        console.error('Error starting QR scanner', error, error.cause)
        props.onError(error)
      })
  })

  onCleanup(() => {
    cleanedUp = true
    try {
      qrScanner?.destroy()
    } catch (_) {}
    if (videoRef) {
      videoRef.removeEventListener('loadedmetadata', handleLoadedMetadata)
      videoRef.removeEventListener('loadeddata', markReady)
      videoRef.removeEventListener('canplay', markReady)
      videoRef.removeEventListener('playing', markReady)
      stopVideoTracks(videoRef)
      videoRef.remove()
      videoRef = undefined
    }
  })

  return (
    <div id="video-container" class="fixed inset-0 z-50 overflow-hidden bg-black text-white">
      <div class="absolute inset-0" ref={videoHostRef} />
      <Show when={!isReady()}>
        <div class="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/60 text-white">
          <Icon name="autorenew" class="animate-spin" size="40" />
          <span class="text-md">Starting camera...</span>
        </div>
      </Show>
      <div class="prose pointer-events-none absolute inset-0 z-20 flex flex-col justify-between pb-7">
        <div class="pointer-events-auto">
          <TopAppBar trailing={<IconButton name="close" href="/" />}>Add new device</TopAppBar>
        </div>
        <div class="flex flex-col items-center gap-3 px-8">
          <Show when={cameras().length > 1}>
            <select
              aria-label="Select camera"
              class="pointer-events-auto rounded-md bg-black/70 px-3 py-1.5 text-sm text-white outline outline-1 outline-white/30"
              value={selectedCamera()}
              onChange={(e) => handleCameraChange(e.currentTarget.value)}
            >
              <For each={cameras()}>{(cam) => <option value={cam.id}>{cam.label || cam.id}</option>}</For>
            </select>
          </Show>
          <h2 class="text-center text-md">Use the viewfinder to scan the QR code on your device</h2>
        </div>
      </div>
    </div>
  )
}

const PairActivity: VoidComponent<{ onPaired: () => void }> = (props) => {
  const { pair } = useLocation().query
  const pairToken: string | undefined = Array.isArray(pair) ? pair[0] : pair

  const state = createMachine<{
    scanning: {
      value: JSX.Element
      to: 'pairing' | 'error'
    }
    pairing: {
      input: { pairToken: string }
      value: JSX.Element
      to: 'error'
    }
    error: {
      input: { error: Error }
      value: JSX.Element
      to: 'scanning'
    }
  }>({
    initial: pairToken
      ? {
          type: 'pairing',
          input: { pairToken },
        }
      : 'scanning',
    states: {
      scanning(_input, to) {
        return <QrScannerView onScan={(token) => to.pairing({ pairToken: token })} onError={(error) => to.error({ error })} />
      },
      pairing(input, to) {
        const navigate = useNavigate()

        pairDevice(input.pairToken)
          .then((dongleId) => navigate(`/${dongleId}`))
          .then(props.onPaired)
          .catch((reason) => {
            const error = toError(reason)
            console.error('Error pairing device', error, error.cause)
            to.error({ error })
          })

        return (
          <>
            <TopAppBar>Add new device</TopAppBar>

            <div class="flex flex-col items-center gap-4">
              <Icon name="autorenew" class="animate-spin" size="40" />
              <span class="text-md">Pairing your device...</span>
            </div>
          </>
        )
      },
      error(input, to) {
        return (
          <>
            <TopAppBar trailing={<IconButton name="close" href="/" />}>Add new device</TopAppBar>

            <div class="flex flex-col items-center gap-4 px-4 max-w-sm mx-auto">
              An error occurred: {input.error.message}
              <Button color="primary" onClick={() => to.scanning()}>
                Retry
              </Button>
            </div>
          </>
        )
      },
    },
  })

  return <div>{state.value}</div>
}

export default PairActivity
