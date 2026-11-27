import { createEffect, createMemo, createResource, createSignal, onCleanup, Show, Suspense, type VoidComponent } from 'solid-js'
import { A } from '@solidjs/router'

import { setRouteViewed } from '~/api/athena'
import { isSignedIn } from '~/api/auth/client'
import { getTimelineEvents } from '~/api/derived'
import { getDevice } from '~/api/devices'
import { getProfile } from '~/api/profile'
import { getRoute } from '~/api/route'
import { getRouteSpritesInWorker, type RouteSprites } from '~/api/sprites-worker-client'
import Button from '~/components/material/Button'
import Icon from '~/components/material/Icon'
import IconButton from '~/components/material/IconButton'
import TopAppBar from '~/components/material/TopAppBar'
import RouteActions from '~/components/RouteActions'
import RouteDetails from '~/components/RouteDetails'
import RouteFiles from '~/components/RouteFiles'
import RouteStaticMap from '~/components/RouteStaticMap'
import RouteStatisticsBar from '~/components/RouteStatisticsBar'
import RouteUploadButtons from '~/components/RouteUploadButtons'
import RouteVideoPlayer from '~/components/RouteVideoPlayer'
import Timeline from '~/components/Timeline'
import { parseTimestamp } from '~/utils/format'
import { resolved } from '~/utils/reactivity'

type RouteActivityProps = {
  dongleId: string
  dateStr: string
  startTime: number
  endTime: number | undefined
}

const RouteActivity: VoidComponent<RouteActivityProps> = (props) => {
  const [seekTime, setSeekTime] = createSignal(props.startTime)
  const [videoRef, setVideoRef] = createSignal<HTMLVideoElement>()

  const routeName = () => `${props.dongleId}|${props.dateStr}`
  const [route] = createResource(routeName, getRoute)
  const startTime = () => (route.latest ? parseTimestamp(route().start_time!).local().format('dddd, MMM D, YYYY') : '')

  const selection = () => ({ startTime: props.startTime, endTime: props.endTime })

  const [events] = createResource(route, getTimelineEvents, { initialValue: [] })

  const [sprites, setSprites] = createSignal<RouteSprites | undefined>(undefined)
  createEffect(() => {
    const r = route()
    if (!r) return
    setSprites(undefined)
    const request = getRouteSpritesInWorker(r)
    request.promise.then(setSprites).catch(() => {})
    onCleanup(() => request.cancel())
  })

  const onTimelineChange = (newTime: number) => {
    const video = videoRef()
    if (video) video.currentTime = newTime
  }

  createEffect(() => {
    routeName() // track changes
    setSeekTime(props.startTime)
    onTimelineChange(props.startTime)
  })

  const [device] = createResource(
    () => (isSignedIn() ? props.dongleId : undefined),
    (dongleId) => getDevice(dongleId).catch(() => undefined),
  )
  const [profile] = createResource(
    () => (isSignedIn() ? true : undefined),
    () => getProfile().catch(() => undefined),
  )

  const canManageRoute = createMemo(() => isSignedIn() && (device()?.is_owner === true || profile()?.superuser === true))
  createEffect(() => {
    if (!resolved(device) || !resolved(profile) || !canManageRoute()) return
    const dongleId = device()?.dongle_id
    if (!dongleId) return
    void setRouteViewed(dongleId, props.dateStr)
  })

  return (
    <>
      <TopAppBar
        component="h2"
        leading={
          <Show
            when={isSignedIn()}
            fallback={
              <A href="/login" class="flex items-center gap-2">
                <img src="/images/logo-connect-light.svg" alt="Openpilot Connect" width={28} height={28} />
              </A>
            }
          >
            <IconButton class="md:hidden" name="arrow_back" href={`/${props.dongleId}`} />
          </Show>
        }
        trailing={
          <Show when={!isSignedIn()}>
            <Button color="secondary" href="/login">
              Sign in
            </Button>
          </Show>
        }
      >
        <Suspense fallback={<div class="skeleton-loader h-[28px] max-w-64 rounded-xs" />}>{startTime() || 'Shared Route'}</Suspense>
      </TopAppBar>

      <Show
        when={!route.error}
        fallback={
          <div class="mx-4 flex flex-col items-center gap-4 rounded-lg bg-surface-container p-8 text-center">
            <Icon name="error" size="40" class="text-on-surface-variant" />
            <div class="flex flex-col gap-1">
              <span class="text-base font-medium text-on-surface">This route is private or unavailable</span>
              <span class="text-sm text-on-surface-variant">
                {isSignedIn() ? 'Make sure you have permission to view this route.' : 'Sign in if this route belongs to your account.'}
              </span>
            </div>
            <Show when={!isSignedIn()}>
              <Button color="primary" href="/login">
                Sign in
              </Button>
            </Show>
          </div>
        }
      >
        <div class="flex flex-col gap-6 px-4 pb-4">
          <div class="flex flex-col">
            <RouteVideoPlayer ref={setVideoRef} routeName={routeName()} selection={selection()} onProgress={setSeekTime} />
            <Timeline
              class="mb-1"
              route={route()}
              seekTime={seekTime()}
              updateTime={onTimelineChange}
              events={events()}
              sprites={sprites()}
            />

            <Show when={selection().startTime || selection().endTime}>
              <A
                class="mt-4 flex items-center justify-center text-center text-label-lg text-gray-500"
                href={`/${props.dongleId}/${props.dateStr}`}
              >
                Clear current route selection
                <IconButton name="close_small" />
              </A>
            </Show>
          </div>

          <div class="flex flex-col gap-2">
            <span class="text-sm">Route Info</span>
            <div class="flex flex-col overflow-hidden rounded-md bg-surface-container">
              <RouteStatisticsBar class="p-5" route={route()} events={events()} />

              <Show when={canManageRoute()}>
                <RouteActions routeName={routeName()} route={route()} />
              </Show>
            </div>
          </div>

          <RouteFiles
            routeName={routeName()}
            dongleId={props.dongleId}
            dateStr={props.dateStr}
            totalSegments={route() ? route()!.maxqlog + 1 : undefined}
            onJumpToSegment={(seg) => onTimelineChange(seg * 60)}
          />

          <Show when={canManageRoute()}>
            <div class="flex flex-col gap-2">
              <span class="text-sm">Upload Files</span>
              <div class="flex flex-col overflow-hidden rounded-md bg-surface-container">
                <RouteUploadButtons route={route()} />
              </div>
            </div>
          </Show>

          <div class="flex flex-col gap-2">
            <span class="text-sm">Route Map</span>
            <div class="aspect-square overflow-hidden rounded-lg">
              <Suspense fallback={<div class="skeleton-loader h-full w-full bg-surface-container" />}>
                <RouteStaticMap route={route()} />
              </Suspense>
            </div>
          </div>

          <RouteDetails routeName={routeName()} route={route()} dongleId={props.dongleId} />
        </div>
      </Show>
    </>
  )
}

export default RouteActivity
