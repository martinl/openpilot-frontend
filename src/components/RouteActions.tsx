import { createEffect, createResource, createSignal, onCleanup, onMount, Show, type VoidComponent } from 'solid-js'
import clsx from 'clsx'

import { USERADMIN_URL } from '~/api/config'
import { getDevice } from '~/api/devices'
import { getPreservedRoutes, parseRouteName, setRoutePreserved, setRoutePublic } from '~/api/route'
import type { Route } from '~/api/types'
import InspectDialog from '~/components/InspectDialog'
import Icon from '~/components/material/Icon'

const ToggleButton: VoidComponent<{
  label: string
  description?: string
  active: boolean | undefined
  onToggle: () => void
}> = (props) => (
  <button
    type="button"
    class="flex w-full items-center justify-between gap-3 rounded-md p-2 text-left transition-colors hover:bg-surface-container-low"
    onClick={() => props.onToggle()}
  >
    <div class="flex flex-col">
      <span class="text-sm text-on-surface-variant">{props.label}</span>
      <Show when={props.description}>
        <span class="text-xs text-on-surface-variant/70">{props.description}</span>
      </Show>
    </div>

    <div
      class={`relative h-6 w-10 shrink-0 rounded-full border-2 transition-colors ${
        props.active ? 'border-green-300 bg-green-300' : 'border-surface-container-highest'
      }`}
    >
      <div
        class={`absolute top-1 size-3 rounded-full bg-surface-container-highest transition-transform duration-300 ease-in-out ${
          props.active ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </div>
  </button>
)

interface RouteActionsProps {
  routeName: string
  route: Route | undefined
}

const RouteActions: VoidComponent<RouteActionsProps> = (props) => {
  const dongleId = () => parseRouteName(props.routeName).dongleId
  const [preservedRoutesResource] = createResource(dongleId, getPreservedRoutes)

  const [isPublic, setIsPublic] = createSignal<boolean | undefined>(undefined)
  const [isPreserved, setIsPreserved] = createSignal<boolean | undefined>(undefined)
  const [toolsOpen, setToolsOpen] = createSignal(false)
  const [inspecting, setInspecting] = createSignal<'route' | 'device' | null>(null)
  const [device] = createResource(() => (inspecting() === 'device' ? dongleId() : undefined), getDevice)

  let toolsRef!: HTMLDivElement

  onMount(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (toolsOpen() && !toolsRef.contains(e.target as Node)) setToolsOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setToolsOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    onCleanup(() => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    })
  })

  const currentRouteId = () => props.routeName.replace('|', '/')
  const useradminUrl = () => `${USERADMIN_URL}/?onebox=${currentRouteId()}`
  const shareUrl = () => `${window.location.origin}/${currentRouteId()}`

  const hasCoords = () =>
    !!props.route && [props.route.start_lat, props.route.start_lng, props.route.end_lat, props.route.end_lng].every((v) => v !== 0)
  const mapsUrl = () => {
    const r = props.route
    if (!r) return ''
    return `https://www.google.com/maps/dir/?api=1&origin=${r.start_lat},${r.start_lng}&destination=${r.end_lat},${r.end_lng}&travelmode=driving`
  }

  createEffect(() => {
    const preservedRoutes = preservedRoutesResource()
    if (!props.route) return
    setIsPublic(props.route.is_public)
    if (Array.isArray(preservedRoutes)) {
      const { fullname } = props.route
      setIsPreserved(preservedRoutes.some((r) => r.fullname === fullname))
    } else {
      setIsPreserved(undefined)
    }
  })

  const [error, setError] = createSignal<string | null>(null)
  const [copied, setCopied] = createSignal(false)
  const [shareCopied, setShareCopied] = createSignal(false)

  const toggleRoute = async (property: 'public' | 'preserved') => {
    setError(null)
    if (property === 'public') {
      const currentValue = isPublic()
      if (currentValue === undefined) return
      try {
        const newValue = !currentValue
        await setRoutePublic(props.routeName, newValue)
        setIsPublic(newValue)
      } catch (err) {
        console.error('Failed to update public toggle', err)
        setError('Failed to update toggle')
      }
    } else {
      const currentValue = isPreserved()
      if (currentValue === undefined) return
      try {
        const newValue = !currentValue
        await setRoutePreserved(props.routeName, newValue)
        setIsPreserved(newValue)
      } catch (err) {
        console.error('Failed to update preserved toggle', err)
        setError('Failed to update toggle')
      }
    }
  }

  const copyCurrentRouteId = async () => {
    if (!props.routeName || !navigator.clipboard) return
    try {
      await navigator.clipboard.writeText(currentRouteId())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy route ID: ', err)
    }
  }

  const copyShareLink = async () => {
    if (!props.routeName || !navigator.clipboard) return
    setError(null)
    try {
      if (isPublic() === false) {
        await setRoutePublic(props.routeName, true)
        setIsPublic(true)
      }
      await navigator.clipboard.writeText(shareUrl())
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy share link: ', err)
      setError('Failed to copy share link')
    }
  }

  const openInspector = (what: 'route' | 'device') => {
    setToolsOpen(false)
    setInspecting(what)
  }

  return (
    <div class="mx-5 mb-4 flex flex-col gap-4 rounded-b-md">
      <div class="font-mono text-xs text-zinc-500">
        <div ref={toolsRef} class="relative flex justify-between">
          <span class="mb-2 text-on-surface-variant">Route ID:</span>
          <button
            type="button"
            onClick={() => setToolsOpen((v) => !v)}
            class="flex items-center gap-1 text-blue-400 duration-200 hover:text-blue-500"
          >
            Tools
            <Icon class={clsx('transition-transform', toolsOpen() && 'rotate-180')} name="expand_more" size="20" />
          </button>

          <Show when={toolsOpen()}>
            <div class="absolute right-0 top-6 z-20 w-60 overflow-hidden rounded-xl bg-surface-container-high py-1 font-sans shadow-xl">
              <a
                href={useradminUrl()}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setToolsOpen(false)}
                class="flex items-center gap-3 px-3 py-2.5 text-sm text-on-surface hover:bg-surface-container-highest"
              >
                <Icon class="text-on-surface-variant" name="open_in_new" size="20" />
                View in useradmin
              </a>
              <Show when={hasCoords()}>
                <a
                  href={mapsUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setToolsOpen(false)}
                  class="flex items-center gap-3 px-3 py-2.5 text-sm text-on-surface hover:bg-surface-container-highest"
                >
                  <Icon class="text-on-surface-variant" name="my_location" size="20" />
                  Open route in Google Maps
                </a>
              </Show>
              <button
                type="button"
                onClick={() => openInspector('route')}
                class="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-on-surface hover:bg-surface-container-highest"
              >
                <Icon class="text-on-surface-variant" name="search" size="20" />
                Inspect route
              </button>
              <button
                type="button"
                onClick={() => openInspector('device')}
                class="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-on-surface hover:bg-surface-container-highest"
              >
                <Icon class="text-on-surface-variant" name="directions_car" size="20" />
                Inspect device
              </button>
            </div>
          </Show>
        </div>

        <button
          type="button"
          onClick={() => void copyCurrentRouteId()}
          class="flex w-full cursor-pointer items-center justify-between rounded-lg border-2 border-surface-container-high bg-surface-container-lowest p-3 hover:bg-surface-container-low"
        >
          <div class="lg:text-sm">
            <span class="inline-block break-keep">{currentRouteId().split('/')[0] || ''}/</span>
            <span class="inline-block break-keep">{currentRouteId().split('/')[1] || ''}</span>
          </div>
          <Icon class={clsx('mx-2', copied() && 'text-green-300')} name={copied() ? 'check' : 'file_copy'} size="20" />
        </button>
      </div>

      <div class="flex flex-col gap-2">
        <ToggleButton label="Preserve Route" active={isPreserved()} onToggle={() => void toggleRoute('preserved')} />
        <ToggleButton
          label="Public Access"
          description="Anyone with the link can view this route"
          active={isPublic()}
          onToggle={() => void toggleRoute('public')}
        />

        <button
          type="button"
          onClick={() => void copyShareLink()}
          class="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border-2 border-surface-container-high bg-surface-container-lowest p-3 hover:bg-surface-container-low"
        >
          <span class="flex flex-col text-left">
            <span class="text-sm text-on-surface-variant">{shareCopied() ? 'Share link copied' : 'Copy share link'}</span>
            <Show when={isPublic() === false}>
              <span class="text-xs text-on-surface-variant/70">Makes this route public</span>
            </Show>
          </span>
          <Icon class={clsx('mx-1', shareCopied() && 'text-green-300')} name={shareCopied() ? 'check' : 'share'} size="20" />
        </button>
      </div>

      <Show when={error()}>
        <div class="flex gap-2 rounded-sm bg-surface-container-high p-2 text-sm text-on-surface">
          <Icon class="text-error" name="error" size="20" />
          {error()}
        </div>
      </Show>

      <InspectDialog
        open={inspecting() !== null}
        onClose={() => setInspecting(null)}
        title={inspecting() === 'device' ? 'Device' : 'Route'}
        subtitle={inspecting() === 'device' ? dongleId() : currentRouteId()}
        data={
          inspecting() === 'device'
            ? (device() as Record<string, unknown> | undefined)
            : (props.route as Record<string, unknown> | undefined)
        }
        error={inspecting() === 'device' && device.error ? 'Failed to load device details' : undefined}
      />
    </div>
  )
}

export default RouteActions
