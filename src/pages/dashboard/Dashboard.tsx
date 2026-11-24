import { createMemo, createResource, lazy, Match, Show, Switch } from 'solid-js'
import type { Component, JSXElement, VoidComponent } from 'solid-js'
import { Navigate, type RouteSectionProps, useLocation } from '@solidjs/router'
import clsx from 'clsx'

import { isSignedIn } from '~/api/auth/client'
import { getDevices } from '~/api/devices'
import { appConfig } from '~/config'
import storage from '~/utils/storage'
import type { Device } from '~/api/types'

import Button from '~/components/material/Button'
import Drawer, { DrawerToggleButton, useDrawerContext } from '~/components/material/Drawer'
import Icon from '~/components/material/Icon'
import TopAppBar from '~/components/material/TopAppBar'

import Sidebar from './components/Sidebar'
import DeviceActivity from './activities/DeviceActivity'
import RouteActivity from './activities/RouteActivity'
import SettingsActivity from './activities/SettingsActivity'
import BuildInfo from '~/components/BuildInfo'
import DeviceSummary from '~/components/DeviceSummary'

const LiveViewActivity = lazy(() => import('./activities/LiveViewActivity'))
const PairActivity = lazy(() => import('./activities/PairActivity'))

const DashboardDrawer: VoidComponent<{ devices: Device[] | undefined; dongleId: string | undefined }> = (props) => {
  const { setOpen } = useDrawerContext()
  return <Sidebar devices={props.devices} dongleId={props.dongleId} onNavigate={() => setOpen(false)} />
}

const DashboardLayout: Component<{
  paneOne: JSXElement
  paneTwo: JSXElement
  paneTwoContent: boolean
}> = (props) => {
  return (
    <div class="relative size-full overflow-hidden">
      <div
        class={clsx(
          'mx-auto size-full max-w-[1600px] md:grid md:grid-cols-2 lg:gap-2',
          // Flex layout for mobile with horizontal transition
          'flex transition-transform duration-300 ease-in-out',
          props.paneTwoContent ? '-translate-x-full md:translate-x-0' : 'translate-x-0',
        )}
      >
        <div class="min-w-full overflow-y-scroll">{props.paneOne}</div>
        <div class="min-w-full overflow-y-scroll">{props.paneTwo}</div>
      </div>
    </div>
  )
}

const FirstPairActivity: Component = () => {
  const { modal } = useDrawerContext()
  return (
    <>
      <TopAppBar
        class="font-bold"
        leading={
          <Show when={!modal()} fallback={<DrawerToggleButton />}>
            <img alt="" src="/images/comma-white.png" class="h-8" />
          </Show>
        }
      >
        Connect
      </TopAppBar>
      <section class="flex flex-col gap-4 py-2 items-center mx-auto max-w-md px-4 mt-4 sm:mt-8 md:mt-16">
        <h2 class="text-xl">Pair your device</h2>
        <p class="text-lg">Scan the QR code on your device</p>
        <p class="text-md mt-4">If you cannot see a QR code, check the following:</p>
        <ul class="text-md list-disc list-inside">
          <li>Your device is connected to the internet</li>
          <li>Your device is on the latest software verison</li>
        </ul>
        <p class="text-md">
          If you still cannot see a QR code, your device may already be paired to another account. Make sure you have signed in to connect
          with the same account you may have used previously.
        </p>
        <Button class="mt-4" leading={<Icon name="add" />} href="/pair">
          Add new device
        </Button>
      </section>
    </>
  )
}

const Dashboard: Component<RouteSectionProps> = () => {
  const location = useLocation()
  const urlState = createMemo(() => {
    const parts = location.pathname.split('/').slice(1).filter(Boolean)
    const startTime = parts[2] ? Math.max(Number(parts[2]), 0) : 0
    const endTime = parts[3] ? Math.max(Number(parts[3]), startTime + 1) : undefined
    return {
      dongleId: parts[0] as string | undefined,
      dateStr: parts[1] as string | undefined,
      startTime,
      endTime,
    }
  })

  const [devices, { refetch }] = createResource(getDevices, { initialValue: undefined })

  const getDefaultDongleId = () => {
    // Do not redirect if dongle ID already selected
    if (urlState().dongleId) return undefined

    const lastSelectedDongleId = storage.getItem('lastSelectedDongleId')
    if (devices()?.some((device) => device.dongle_id === lastSelectedDongleId)) return lastSelectedDongleId
    return devices()?.[0]?.dongle_id
  }

  return (
    <Drawer drawer={<DashboardDrawer devices={devices()} dongleId={urlState().dongleId} />}>
      <Switch>
        <Match when={!isSignedIn()}>
          <Navigate href="/login" />
        </Match>
        <Match when={urlState().dongleId === 'pair' || !!location.query.pair}>
          <PairActivity onPaired={refetch} />
        </Match>
        <Match when={urlState().dongleId} keyed>
          {(dongleId) => (
            <DashboardLayout
              paneOne={<DeviceActivity dongleId={dongleId} />}
              paneTwo={
                <Switch
                  fallback={
                    <div class="hidden size-full flex-col gap-4 px-4 pb-4 md:flex">
                      <TopAppBar component="h2">Overview</TopAppBar>
                      <DeviceSummary dongleId={dongleId} />
                      <div class="flex flex-1 flex-col items-center justify-center gap-3 text-on-surface-variant">
                        <Icon name="search" size="40" />
                        <span class="text-sm">Select a drive to view it</span>
                      </div>
                      <BuildInfo class="self-center" />
                    </div>
                  }
                >
                  <Match when={urlState().dateStr === 'settings' || urlState().dateStr === 'prime'}>
                    <SettingsActivity dongleId={dongleId} />
                  </Match>
                  <Match when={appConfig.enableLiveView && urlState().dateStr === 'live'}>
                    <LiveViewActivity dongleId={dongleId} />
                  </Match>
                  <Match when={urlState().dateStr} keyed>
                    {(dateStr) => (
                      <RouteActivity dongleId={dongleId} dateStr={dateStr} startTime={urlState().startTime} endTime={urlState().endTime} />
                    )}
                  </Match>
                </Switch>
              }
              paneTwoContent={!!urlState().dateStr}
            />
          )}
        </Match>
        <Match when={getDefaultDongleId()} keyed>
          {(defaultDongleId) => <Navigate href={`/${defaultDongleId}`} />}
        </Match>
        <Match when={devices()?.length === 0}>
          <FirstPairActivity />
        </Match>
      </Switch>
    </Drawer>
  )
}

export default Dashboard
