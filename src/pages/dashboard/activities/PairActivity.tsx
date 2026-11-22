import { createSignal, For, onCleanup, onMount, Show, type JSX, type VoidComponent } from 'solid-js'
import { Portal } from 'solid-js/web'
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

const QrScannerView: VoidComponent<{
  onScan: (pairToken: string) => void
  onError: (error: Error) => void
}> = (props) => {
  let videoRef!: HTMLVideoElement
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

  const handleCameraChange = (cameraId: string) => {
    setSelectedCamera(cameraId)
    setIsReady(false)
    void qrScanner?.setCamera(cameraId).catch((reason) => {
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

    qrScanner = new QrScanner(
      videoRef,
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
        preferredCamera: 'environment',
      },
    )

    void qrScanner
      .start()
      .then(async () => {
        if (cleanedUp) {
          try {
            qrScanner?.destroy()
          } catch (_) {}
          stopVideoTracks(videoRef)
          return
        }
        markReady()
        try {
          const available = await QrScanner.listCameras(true)
          if (cleanedUp) return
          setCameras(available)
          const activeTrack = (videoRef.srcObject as MediaStream | null)?.getVideoTracks?.()[0]
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
    stopVideoTracks(videoRef)
  })

  return (
    <Portal>
      <div id="video-container" class="fixed inset-0 z-50 overflow-hidden bg-black text-white">
        <video
          class="absolute inset-0 block size-full object-cover"
          autoplay
          muted
          playsinline
          onLoadedData={markReady}
          onPlaying={markReady}
          ref={videoRef}
        />
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
    </Portal>
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
