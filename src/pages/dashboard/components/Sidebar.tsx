import { createMemo, createResource, createSignal, For, onCleanup, onMount, Show, Suspense, type VoidComponent } from 'solid-js'
import { A, useLocation } from '@solidjs/router'
import clsx from 'clsx'

import { USERADMIN_URL } from '~/api/config'
import { getProfile } from '~/api/profile'
import type { Device } from '~/api/types'
import Icon, { type IconName } from '~/components/material/Icon'
import { appConfig } from '~/config'
import { getDeviceName } from '~/utils/device'
import storage from '~/utils/storage'

type NavItem = { label: string; icon: IconName; path: string }

const navFor = (dongleId: string): NavItem[] => {
  const items: NavItem[] = [{ label: 'Home', icon: 'home', path: `/${dongleId}` }]
  if (appConfig.enableLiveView) {
    items.push({ label: 'Live view', icon: 'videocam', path: `/${dongleId}/live` })
  }
  items.push({ label: 'Settings', icon: 'settings', path: `/${dongleId}/settings` })
  return items
}

const relativeSeen = (device: Device | undefined): string => {
  if (!device) return ''
  if (device.is_online) return 'online'
  const seconds = device.last_athena_ping
  if (!seconds) return 'never seen'
  const delta = Date.now() / 1000 - seconds
  if (delta < 3600) return `${Math.round(delta / 60)}m ago`
  if (delta < 86400) return `${Math.round(delta / 3600)}h ago`
  return `${Math.round(delta / 86400)}d ago`
}

const DeviceOption: VoidComponent<{ device: Device; onSelect: (device: Device) => void }> = (props) => (
  <A
    href={`/${props.device.dongle_id}`}
    onClick={() => props.onSelect(props.device)}
    class="flex items-center gap-2 px-3 py-2 hover:bg-surface-container-highest"
  >
    <div class={clsx('size-1.5 shrink-0 rounded-full', props.device.is_online ? 'bg-green-400' : 'bg-gray-400')} />
    <div class="min-w-0 flex-1">
      <div class="truncate text-sm text-on-surface">{getDeviceName(props.device)}</div>
      <div class="truncate font-mono text-[11px] lowercase text-on-surface-variant">{props.device.dongle_id}</div>
    </div>
  </A>
)

const Sidebar: VoidComponent<{ devices: Device[] | undefined; dongleId: string | undefined; onNavigate?: () => void }> = (props) => {
  const [profile] = createResource(getProfile)
  const [pickerOpen, setPickerOpen] = createSignal(false)
  const [accountOpen, setAccountOpen] = createSignal(false)
  const location = useLocation()

  let rootRef!: HTMLDivElement

  const current = () => props.devices?.find((d) => d.dongle_id === props.dongleId)
  const others = createMemo(() => props.devices?.filter((d) => d.dongle_id !== props.dongleId) ?? [])
  const ownedOthers = createMemo(() => others().filter((d) => d.is_owner))
  const sharedOthers = createMemo(() => others().filter((d) => !d.is_owner))

  const isActive = (path: string) => {
    const here = location.pathname.replace(/\/$/, '')
    const tail = path.split('/').slice(2).join('/')
    if (!tail) {
      const rest = here.split('/').slice(2).join('/')
      return here.startsWith(`/${props.dongleId}`) && !['live', 'settings', 'prime'].includes(rest)
    }
    return here === path
  }

  const closeMenus = () => {
    setPickerOpen(false)
    setAccountOpen(false)
  }

  const go = () => {
    closeMenus()
    props.onNavigate?.()
  }

  const selectDevice = (device: Device) => {
    storage.setItem('lastSelectedDongleId', device.dongle_id)
    go()
  }

  onMount(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.contains(e.target as Node)) closeMenus()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    onCleanup(() => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    })
  })

  return (
    <div ref={rootRef} class="flex h-full flex-col bg-surface-container-lowest">
      <A href={props.dongleId ? `/${props.dongleId}` : '/'} onClick={go} class="flex items-center gap-3 px-5 pb-5 pt-6">
        <img src="/images/logo-connect-light.svg" alt="" width={32} height={32} class="shrink-0" />
        <span class="text-lg font-semibold text-on-surface">Openpilot Connect</span>
      </A>

      <Show when={props.dongleId}>
        <div class="relative px-3">
          <button
            type="button"
            onClick={() => {
              setAccountOpen(false)
              setPickerOpen((v) => !v)
            }}
            class="flex w-full items-center gap-2 rounded-xl bg-surface-container p-3 text-left transition-colors hover:bg-surface-container-high"
          >
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-medium text-on-surface">{current() ? getDeviceName(current()!) : props.dongleId}</div>
              <div class="flex items-center gap-1.5">
                <div class={clsx('size-1.5 rounded-full', current()?.is_online ? 'bg-green-400' : 'bg-gray-400')} />
                <span class="truncate text-xs text-on-surface-variant">{relativeSeen(current())}</span>
              </div>
            </div>
            <Icon
              class={clsx('shrink-0 text-on-surface-variant transition-transform', pickerOpen() && 'rotate-180')}
              name="expand_more"
              size="20"
            />
          </button>

          <Show when={pickerOpen()}>
            <div class="absolute inset-x-3 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl bg-surface-container-high py-1 shadow-xl">
              <Show when={others().length > 0} fallback={<div class="px-3 py-2 text-xs text-on-surface-variant">No other devices</div>}>
                <For each={ownedOthers()}>{(device) => <DeviceOption device={device} onSelect={selectDevice} />}</For>
                <Show when={sharedOthers().length > 0}>
                  <div class="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">Shared devices</div>
                  <For each={sharedOthers()}>{(device) => <DeviceOption device={device} onSelect={selectDevice} />}</For>
                </Show>
              </Show>
              <A
                href="/pair"
                onClick={go}
                class="mt-1 flex items-center gap-2 border-t border-surface-container-highest px-3 py-2 hover:bg-surface-container-highest"
              >
                <Icon class="text-on-surface-variant" name="add" size="20" />
                <span class="text-sm text-on-surface">Add new device</span>
              </A>
            </div>
          </Show>
        </div>
      </Show>

      <nav class="mt-6 flex min-h-0 flex-1 flex-col overflow-y-auto px-3">
        <Show when={props.dongleId}>
          <span class="px-2 pb-2 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant/70">Menu</span>
          <For each={navFor(props.dongleId!)}>
            {(item) => (
              <A
                href={item.path}
                onClick={go}
                class={clsx(
                  'mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                  isActive(item.path)
                    ? 'bg-surface-container-high font-medium text-on-surface'
                    : 'text-on-surface-variant hover:bg-surface-container',
                )}
              >
                <Icon class={clsx(isActive(item.path) && 'text-primary')} name={item.icon} size="20" filled={isActive(item.path)} />
                {item.label}
              </A>
            )}
          </For>
        </Show>
      </nav>

      <div class="relative border-t border-surface-container p-3">
        <Show when={accountOpen()}>
          <div class="absolute inset-x-3 bottom-full z-20 mb-1 overflow-hidden rounded-xl bg-surface-container-high py-1 shadow-xl">
            <a
              href={USERADMIN_URL}
              target="_blank"
              rel="noreferrer"
              onClick={go}
              class="flex items-center gap-2 px-3 py-2 hover:bg-surface-container-highest"
            >
              <Icon class="text-on-surface-variant" name="open_in_new" size="20" />
              <span class="text-sm text-on-surface">Useradmin</span>
            </a>
            <A
              href="/logout"
              onClick={go}
              class="flex items-center gap-2 border-t border-surface-container-highest px-3 py-2 hover:bg-surface-container-highest"
            >
              <Icon class="text-on-surface-variant" name="logout" size="20" />
              <span class="text-sm text-on-surface">Sign out</span>
            </A>
          </div>
        </Show>
        <Suspense fallback={<div class="h-12 rounded-xl skeleton-loader" />}>
          <button
            type="button"
            onClick={() => {
              setPickerOpen(false)
              setAccountOpen((v) => !v)
            }}
            class="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-surface-container"
          >
            <div class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
              <Icon name="person" size="20" filled />
            </div>
            <span class="min-w-0 flex-1 truncate text-sm text-on-surface-variant">{profile()?.email}</span>
            <Icon
              class={clsx('shrink-0 text-on-surface-variant transition-transform', accountOpen() && 'rotate-180')}
              name="expand_more"
              size="20"
            />
          </button>
        </Suspense>
      </div>
    </div>
  )
}

export default Sidebar
