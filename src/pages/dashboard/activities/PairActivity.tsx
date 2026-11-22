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
        let videoRef!: HTMLVideoElement
        let qrScanner: QrScanner | undefined
        const [cameras, setCameras] = createSignal<QrScanner.Camera[]>([])
        const [selectedCamera, setSelectedCamera] = createSignal<string>('environment')

        onMount(() => {
          qrScanner = new QrScanner(
            videoRef,
            (result) => {
              qrScanner?.destroy()
              to.pairing({ pairToken: result.data })
            },
            {
              highlightScanRegion: true,
              preferredCamera: 'environment',
            },
          )
          void qrScanner
            .start()
            .then(async () => {
              const available = await QrScanner.listCameras(true)
              setCameras(available)
              if (available.length > 0) {
                const activeTrack = (videoRef.srcObject as MediaStream | null)?.getVideoTracks?.()[0]
                const activeDeviceId = activeTrack?.getSettings?.().deviceId
                if (activeDeviceId) setSelectedCamera(activeDeviceId)
              }
            })
            .catch((reason) => {
              const error = toError(reason)
              console.error('Error starting QR scanner', error, error.cause)
              to.error({ error })
            })
        })

        onCleanup(() => {
          try {
            qrScanner?.destroy()
          } catch (_) {}
        })

        const handleCameraChange = (cameraId: string) => {
          setSelectedCamera(cameraId)
          void qrScanner?.setCamera(cameraId)
        }

        return (
          <div id="video-container" class="fixed inset-0 z-50 bg-black text-white">
            <video class="absolute inset-0 size-full object-cover" autoplay muted playsinline ref={videoRef} />
            <div class="prose absolute inset-0 flex flex-col justify-between pb-7">
              <TopAppBar trailing={<IconButton name="close" href="/" />}>Add new device</TopAppBar>
              <div class="flex flex-col items-center gap-3 px-8">
                <Show when={cameras().length > 1}>
                  <select
                    class="rounded-md bg-black/70 px-3 py-1.5 text-sm text-white outline outline-1 outline-white/30"
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
