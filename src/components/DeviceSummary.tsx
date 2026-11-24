import { createResource, createSignal, For, Show, type JSX, type ParentComponent, type VoidComponent } from 'solid-js'
import clsx from 'clsx'

import { fetcher } from '~/api'
import { getDeviceStats } from '~/api/devices'
import type { Route } from '~/api/types'
import Icon from '~/components/material/Icon'
import { formatDistance, formatDuration } from '~/utils/format'

const Card: ParentComponent<{ title: string; trailing?: JSX.Element }> = (props) => (
  <div class="flex flex-col gap-3">
    <div class="flex items-center justify-between gap-3">
      <span class="text-sm">{props.title}</span>
      {props.trailing}
    </div>
    <div class="overflow-hidden rounded-md bg-surface-container">{props.children}</div>
  </div>
)

const Row: VoidComponent<{ label: string; value: string | number | undefined; mono?: boolean; href?: string; copy?: boolean }> = (
  props,
) => {
  const [copied, setCopied] = createSignal(false)
  const text = () => (props.value === undefined || props.value === '' ? undefined : String(props.value))

  return (
    <Show when={text()}>
      {(value) => (
        <div class="flex items-center gap-3 border-b border-surface-container-high px-4 py-2.5 last:border-0">
          <span class="shrink-0 text-sm text-on-surface-variant">{props.label}</span>
          <Show
            when={props.href}
            fallback={
              <span class={clsx('min-w-0 flex-1 truncate text-right text-sm text-on-surface', props.mono && 'font-mono')}>{value()}</span>
            }
          >
            {(href) => (
              <a
                href={href()}
                target="_blank"
                rel="noreferrer"
                class="min-w-0 flex-1 truncate text-right text-sm text-primary hover:underline"
              >
                {value()}
              </a>
            )}
          </Show>
          <Show when={props.copy}>
            <button
              type="button"
              title="Copy"
              onClick={() =>
                void navigator.clipboard?.writeText(value()).then(() => {
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1200)
                })
              }
              class="shrink-0 rounded p-1 text-on-surface-variant hover:bg-surface-container-high"
            >
              <Icon name={copied() ? 'check' : 'file_copy'} size="20" />
            </button>
          </Show>
        </div>
      )}
    </Show>
  )
}

const DeviceSummary: VoidComponent<{ dongleId: string }> = (props) => {
  const [stats] = createResource(() => props.dongleId, getDeviceStats)
  // Build metadata lives on routes rather than the device record, so read the newest route.
  const [latest] = createResource(
    () => props.dongleId,
    (dongleId) => fetcher<Route[]>(`/v1/devices/${dongleId}/routes?limit=1&offset=0`).catch(() => undefined),
  )
  const [weekly, setWeekly] = createSignal(false)

  const period = () => (weekly() ? stats()?.week : stats()?.all)
  const route = () => latest()?.[0]
  const repo = () =>
    route()
      ?.git_remote?.replace(/^https?:\/\//, '')
      .replace(/\.git$/, '')

  return (
    <div class="grid gap-4 lg:grid-cols-2">
      <Card
        title="Statistics"
        trailing={
          <div class="flex overflow-hidden rounded-lg bg-surface-container-high p-0.5">
            <For each={[false, true]}>
              {(isWeek) => (
                <button
                  type="button"
                  onClick={() => setWeekly(isWeek)}
                  class={clsx(
                    'rounded-md px-3 py-1 text-xs transition-colors',
                    weekly() === isWeek ? 'bg-on-surface font-medium text-surface-container' : 'text-on-surface-variant',
                  )}
                >
                  {isWeek ? 'Weekly' : 'All'}
                </button>
              )}
            </For>
          </div>
        }
      >
        <Row label="Distance" value={formatDistance(period()?.distance)} />
        <Row label="Time" value={formatDuration(period()?.minutes)} />
        <Row label="Drives" value={period()?.routes} />
      </Card>

      <Card title="Vehicle info">
        <Row label="Dongle ID" value={props.dongleId} mono copy />
        <Row label="Vehicle" value={route()?.platform || undefined} mono copy />
        <Row label="Repo" value={repo()} href={route()?.git_remote || undefined} />
        <Row label="Branch" value={route()?.git_branch || undefined} mono copy />
        <Row label="Commit" value={route()?.git_commit?.slice(0, 7) || undefined} mono copy />
        <Row label="Version" value={route()?.version || undefined} mono copy />
        <Show when={!latest.loading && !route()}>
          <div class="px-4 py-2.5 text-xs text-on-surface-variant">No drives recorded yet</div>
        </Show>
      </Card>
    </div>
  )
}

export default DeviceSummary
